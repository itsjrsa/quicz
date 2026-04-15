import { Server as SocketIOServer, Socket } from "socket.io";
import { db } from "@/db";
import {
  liveSessions,
  participants,
  responses,
  questions,
  choices,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { scoreQuestion } from "@/lib/scoring";
import { v4 as uuidv4 } from "uuid";
import type {
  SessionStatePayload,
  AdminStatePayload,
  ParticipantJoinPayload,
  ParticipantSubmitPayload,
  AdminJoinPayload,
  AdminActionPayload,
} from "./events";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getSession(sessionId: string) {
  return db.select().from(liveSessions).where(eq(liveSessions.id, sessionId)).get() ?? null;
}

function getSessionByCode(code: string) {
  return db.select().from(liveSessions).where(eq(liveSessions.code, code)).get() ?? null;
}

function getQuestions(quizId: string) {
  return db.select().from(questions).where(eq(questions.quizId, quizId)).orderBy(questions.order).all();
}

function getChoices(questionIds: string[]) {
  if (questionIds.length === 0) return [];
  return db.select().from(choices).where(inArray(choices.questionId, questionIds)).orderBy(choices.order).all();
}

function getParticipantCount(sessionId: string): number {
  return db.select().from(participants).where(eq(participants.sessionId, sessionId)).all().length;
}

function getResponseCount(sessionId: string, questionId: string): number {
  return db
    .select()
    .from(responses)
    .where(eq(responses.sessionId, sessionId))
    .all()
    .filter((r) => r.questionId === questionId).length;
}

function buildSessionState(
  session: typeof liveSessions.$inferSelect,
  quizQuestions: (typeof questions.$inferSelect)[],
  allChoices: (typeof choices.$inferSelect)[],
  participantId?: string
): SessionStatePayload {
  const question =
    session.phase !== "lobby" && session.phase !== "final"
      ? quizQuestions[session.currentQuestionIndex] ?? null
      : null;

  const questionChoices = question
    ? allChoices.filter((c) => c.questionId === question.id).map((c) => ({ id: c.id, text: c.text }))
    : [];

  let mySubmission: string[] | null = null;
  if (participantId && question) {
    const existing = db
      .select()
      .from(responses)
      .where(eq(responses.participantId, participantId))
      .all()
      .find((r) => r.questionId === question.id && r.sessionId === session.id);
    if (existing) {
      try {
        mySubmission = JSON.parse(existing.choiceIds) as string[];
      } catch {
        mySubmission = null;
      }
    }
  }

  return {
    phase: session.phase as SessionStatePayload["phase"],
    currentQuestionIndex: session.currentQuestionIndex,
    answersVisible: Boolean(session.answersVisible),
    correctRevealed: Boolean(session.correctRevealed),
    question: question
      ? {
          id: question.id,
          title: question.title,
          description: question.description,
          type: question.type as "binary" | "single" | "multi",
          points: question.points,
        }
      : null,
    choices: questionChoices,
    mySubmission,
  };
}

function buildAdminState(
  session: typeof liveSessions.$inferSelect,
  quizQuestions: (typeof questions.$inferSelect)[]
): AdminStatePayload {
  const participantCount = getParticipantCount(session.id);
  const question =
    session.phase !== "lobby" && session.phase !== "final"
      ? quizQuestions[session.currentQuestionIndex] ?? null
      : null;
  const responseCount = question ? getResponseCount(session.id, question.id) : 0;

  return {
    sessionId: session.id,
    phase: session.phase,
    currentQuestionIndex: session.currentQuestionIndex,
    answersVisible: Boolean(session.answersVisible),
    correctRevealed: Boolean(session.correctRevealed),
    status: session.status,
    participantCount,
    responseCount,
    totalParticipants: participantCount,
    question: question
      ? { id: question.id, title: question.title, type: question.type, points: question.points }
      : null,
  };
}

function broadcastSessionState(
  io: SocketIOServer,
  session: typeof liveSessions.$inferSelect
) {
  const quizQuestions = getQuestions(session.quizId);
  const allChoices = getChoices(quizQuestions.map((q) => q.id));

  // Broadcast common state (without personalized mySubmission) to all participants
  const statePayload = buildSessionState(session, quizQuestions, allChoices);
  io.to(`session:${session.code}`).emit("session:state", statePayload);

  // Admin state
  const adminPayload = buildAdminState(session, quizQuestions);
  io.to(`admin:${session.id}`).emit("admin:state", adminPayload);
}

function computeScoreboard(
  sessionId: string
): { participantId: string; displayName: string; score: number; correctCount: number; rank: number }[] {
  const sessionParticipants = db.select().from(participants).where(eq(participants.sessionId, sessionId)).all();
  const sessionResponses =
    sessionParticipants.length > 0
      ? db.select().from(responses).where(eq(responses.sessionId, sessionId)).all()
      : [];

  const scoreMap = new Map<string, { score: number; correctCount: number }>();
  for (const p of sessionParticipants) {
    scoreMap.set(p.id, { score: 0, correctCount: 0 });
  }
  for (const r of sessionResponses) {
    const entry = scoreMap.get(r.participantId);
    if (entry) {
      entry.score += r.pointsEarned ?? 0;
      entry.correctCount += r.isCorrect === 1 ? 1 : 0;
    }
  }

  const participantMap = new Map(sessionParticipants.map((p) => [p.id, p]));
  const sorted = Array.from(scoreMap.entries())
    .map(([participantId, { score, correctCount }]) => ({
      participantId,
      displayName: participantMap.get(participantId)?.displayName ?? "",
      score,
      correctCount,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      return a.displayName.localeCompare(b.displayName);
    });

  // Dense rank: ties share the same rank, next distinct group gets rank+1
  let rank = 1;
  return sorted.map((entry, i) => {
    if (i > 0) {
      const prev = sorted[i - 1];
      if (entry.score !== prev.score || entry.correctCount !== prev.correctCount) {
        rank++;
      }
    }
    return { ...entry, rank };
  });
}

// ─── Setup ───────────────────────────────────────────────────────────────────

export function setupSocketHandlers(io: SocketIOServer) {
  io.on("connection", (socket: Socket) => {
    // ── Participant join ────────────────────────────────────────────────────
    socket.on("participant:join", (payload: ParticipantJoinPayload) => {
      const session = getSessionByCode(payload.sessionCode.toUpperCase());
      if (!session) return;

      let participant = payload.participantId
        ? db.select().from(participants).where(eq(participants.id, payload.participantId)).get()
        : null;

      if (!participant || participant.sessionId !== session.id) {
        // New participant
        participant = {
          id: uuidv4(),
          sessionId: session.id,
          displayName: payload.displayName.trim(),
          joinedAt: Date.now(),
        };
        db.insert(participants).values(participant).run();

        // Notify admin
        io.to(`admin:${session.id}`).emit("admin:participant-joined", {
          participantId: participant.id,
          displayName: participant.displayName,
        });
      }

      socket.join(`session:${session.code}`);
      // Store participant context in socket data for submit handler
      socket.data.participantId = participant.id;
      socket.data.sessionId = session.id;
      socket.data.sessionCode = session.code;

      socket.emit("participant:confirmed", { participantId: participant.id });

      // Send personalized state (includes mySubmission)
      const quizQuestions = getQuestions(session.quizId);
      const allChoices = getChoices(quizQuestions.map((q) => q.id));
      const state = buildSessionState(session, quizQuestions, allChoices, participant.id);
      socket.emit("session:state", state);
    });

    // ── Participant submit ──────────────────────────────────────────────────
    socket.on("participant:submit", (payload: ParticipantSubmitPayload) => {
      const { participantId, sessionId } = socket.data as { participantId?: string; sessionId?: string };
      if (!participantId || !sessionId) return;

      const session = getSession(sessionId);
      if (!session || session.phase !== "question_open") return;

      if (!Array.isArray(payload.choiceIds) || payload.choiceIds.length === 0) return;

      // Upsert response
      const existing = db
        .select()
        .from(responses)
        .where(eq(responses.participantId, participantId))
        .all()
        .find((r) => r.questionId === payload.questionId && r.sessionId === sessionId);

      if (existing) {
        db.update(responses)
          .set({ choiceIds: JSON.stringify(payload.choiceIds), submittedAt: Date.now() })
          .where(eq(responses.id, existing.id))
          .run();
      } else {
        db.insert(responses)
          .values({
            id: uuidv4(),
            participantId,
            sessionId,
            questionId: payload.questionId,
            choiceIds: JSON.stringify(payload.choiceIds),
            isCorrect: null,
            pointsEarned: null,
            submittedAt: Date.now(),
          })
          .run();
      }

      // Update admin response count
      const responseCount = getResponseCount(sessionId, payload.questionId);
      const totalParticipants = getParticipantCount(sessionId);
      io.to(`admin:${sessionId}`).emit("admin:response-count", {
        questionId: payload.questionId,
        count: responseCount,
        total: totalParticipants,
      });
    });

    // ── Admin join ──────────────────────────────────────────────────────────
    socket.on("admin:join", (payload: AdminJoinPayload) => {
      const session = getSession(payload.sessionId);
      if (!session) return;

      socket.join(`admin:${session.id}`);
      socket.data.adminSessionId = session.id;

      const quizQuestions = getQuestions(session.quizId);
      const adminPayload = buildAdminState(session, quizQuestions);
      socket.emit("admin:state", adminPayload);
    });

    // ── Admin: next ─────────────────────────────────────────────────────────
    socket.on("admin:next", (payload: AdminActionPayload) => {
      const session = getSession(payload.sessionId);
      if (!session) return;

      if (session.phase === "lobby") {
        db.update(liveSessions)
          .set({ phase: "question_open", currentQuestionIndex: 0, answersVisible: 0, correctRevealed: 0 })
          .where(eq(liveSessions.id, session.id))
          .run();
      } else if (session.phase === "results") {
        const quizQuestions = getQuestions(session.quizId);
        const nextIndex = session.currentQuestionIndex + 1;
        if (nextIndex < quizQuestions.length) {
          db.update(liveSessions)
            .set({ phase: "question_open", currentQuestionIndex: nextIndex, answersVisible: 0, correctRevealed: 0 })
            .where(eq(liveSessions.id, session.id))
            .run();
        }
      }

      const updated = getSession(payload.sessionId)!;
      broadcastSessionState(io, updated);
    });

    // ── Admin: prev ─────────────────────────────────────────────────────────
    // Admin-only review: moves currentQuestionIndex back without broadcasting to participants
    socket.on("admin:prev", (payload: AdminActionPayload) => {
      const session = getSession(payload.sessionId);
      if (!session || session.phase !== "results") return;

      const prevIndex = session.currentQuestionIndex - 1;
      if (prevIndex < 0) return;

      db.update(liveSessions)
        .set({ currentQuestionIndex: prevIndex })
        .where(eq(liveSessions.id, session.id))
        .run();

      // Only notify admin, not participants
      const updated = getSession(payload.sessionId)!;
      const quizQuestions = getQuestions(updated.quizId);
      io.to(`admin:${session.id}`).emit("admin:state", buildAdminState(updated, quizQuestions));
    });

    // ── Admin: open-voting ──────────────────────────────────────────────────
    socket.on("admin:open-voting", (payload: AdminActionPayload) => {
      const session = getSession(payload.sessionId);
      if (!session || session.phase !== "question_locked") return;

      db.update(liveSessions)
        .set({ phase: "question_open" })
        .where(eq(liveSessions.id, session.id))
        .run();

      const updated = getSession(payload.sessionId)!;
      broadcastSessionState(io, updated);
    });

    // ── Admin: lock-voting ──────────────────────────────────────────────────
    socket.on("admin:lock-voting", (payload: AdminActionPayload) => {
      const session = getSession(payload.sessionId);
      if (!session || session.phase !== "question_open") return;

      db.update(liveSessions)
        .set({ phase: "question_locked" })
        .where(eq(liveSessions.id, session.id))
        .run();

      // Score all responses for the current question (synchronous with better-sqlite3)
      const quizQuestions = getQuestions(session.quizId);
      const currentQuestion = quizQuestions[session.currentQuestionIndex];
      if (currentQuestion) {
        scoreQuestion(currentQuestion.id, session.id);
      }

      const updated = getSession(payload.sessionId)!;
      broadcastSessionState(io, updated);
    });

    // ── Admin: show-results ─────────────────────────────────────────────────
    socket.on("admin:show-results", (payload: AdminActionPayload) => {
      const session = getSession(payload.sessionId);
      if (!session || session.phase !== "question_locked") return;

      db.update(liveSessions)
        .set({ phase: "results", answersVisible: 1 })
        .where(eq(liveSessions.id, session.id))
        .run();

      const updated = getSession(payload.sessionId)!;
      broadcastSessionState(io, updated);

      // Send answer distribution to participants
      const quizQuestions = getQuestions(updated.quizId);
      const currentQuestion = quizQuestions[updated.currentQuestionIndex];
      if (currentQuestion) {
        const questionChoices = getChoices([currentQuestion.id]);
        const questionResponses = db
          .select()
          .from(responses)
          .where(eq(responses.questionId, currentQuestion.id))
          .all()
          .filter((r) => r.sessionId === session.id);

        const distribution = questionChoices.map((c) => ({
          choiceId: c.id,
          count: questionResponses.filter((r) => {
            try {
              return (JSON.parse(r.choiceIds) as string[]).includes(c.id);
            } catch {
              return false;
            }
          }).length,
        }));

        io.to(`session:${session.code}`).emit("session:results", {
          questionId: currentQuestion.id,
          distribution,
        });
      }
    });

    // ── Admin: show-correct ─────────────────────────────────────────────────
    socket.on("admin:show-correct", (payload: AdminActionPayload) => {
      const session = getSession(payload.sessionId);
      if (!session || session.phase !== "results") return;

      db.update(liveSessions)
        .set({ correctRevealed: 1 })
        .where(eq(liveSessions.id, session.id))
        .run();

      const updated = getSession(payload.sessionId)!;
      broadcastSessionState(io, updated);

      // Send personalized correct-answer event to each participant socket
      const quizQuestions = getQuestions(updated.quizId);
      const currentQuestion = quizQuestions[updated.currentQuestionIndex];
      if (currentQuestion) {
        const questionChoices = getChoices([currentQuestion.id]);
        const correctChoiceIds = questionChoices.filter((c) => c.isCorrect === 1).map((c) => c.id);

        const room = io.sockets.adapter.rooms.get(`session:${updated.code}`);
        if (room) {
          for (const socketId of Array.from(room)) {
            const targetSocket = io.sockets.sockets.get(socketId);
            if (!targetSocket) continue;

            const pId = targetSocket.data.participantId as string | undefined;
            let participantResult: { isCorrect: boolean; pointsEarned: number } | null = null;
            if (pId) {
              const r = db
                .select()
                .from(responses)
                .where(eq(responses.participantId, pId))
                .all()
                .find((resp) => resp.questionId === currentQuestion.id && resp.sessionId === session.id);
              if (r) {
                participantResult = { isCorrect: r.isCorrect === 1, pointsEarned: r.pointsEarned ?? 0 };
              }
            }

            targetSocket.emit("session:correct", {
              questionId: currentQuestion.id,
              correctChoiceIds,
              participantResult,
            });
          }
        }
      }
    });

    // ── Admin: show-scoreboard ──────────────────────────────────────────────
    socket.on("admin:show-scoreboard", (payload: AdminActionPayload) => {
      const session = getSession(payload.sessionId);
      if (!session || session.phase !== "results") return;

      db.update(liveSessions)
        .set({ phase: "final" })
        .where(eq(liveSessions.id, session.id))
        .run();

      const updated = getSession(payload.sessionId)!;
      broadcastSessionState(io, updated);

      const rankings = computeScoreboard(session.id);
      io.to(`session:${session.code}`).emit("session:scoreboard", { rankings });
      io.to(`admin:${session.id}`).emit("session:scoreboard", { rankings });
    });

    // ── Admin: end-session ──────────────────────────────────────────────────
    socket.on("admin:end-session", (payload: AdminActionPayload) => {
      const session = getSession(payload.sessionId);
      if (!session) return;

      db.update(liveSessions)
        .set({ status: "finished", finishedAt: Date.now() })
        .where(eq(liveSessions.id, session.id))
        .run();

      io.to(`session:${session.code}`).emit("session:ended", {});

      const updated = getSession(payload.sessionId)!;
      const quizQuestions = getQuestions(updated.quizId);
      io.to(`admin:${session.id}`).emit("admin:state", buildAdminState(updated, quizQuestions));
    });
  });
}
