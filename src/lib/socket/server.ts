import { Server as SocketIOServer, Socket } from "socket.io";
import { db } from "../../db";
import {
  liveSessions,
  participants,
  responses,
  questions,
  choices,
  quizzes,
} from "../../db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { scoreQuestion } from "../scoring";
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

const GRACE_MS = 1000;
const autoLockTimers = new Map<string, NodeJS.Timeout>();

// Share io across Next.js bundler module boundaries via globalThis
const IO_KEY = Symbol.for("quicz.io");
type IoGlobal = typeof globalThis & { [IO_KEY]?: SocketIOServer };
export function getIo(): SocketIOServer | null {
  return (globalThis as IoGlobal)[IO_KEY] ?? null;
}
function setIo(io: SocketIOServer) {
  (globalThis as IoGlobal)[IO_KEY] = io;
}

function getSession(sessionId: string) {
  return db.select().from(liveSessions).where(eq(liveSessions.id, sessionId)).get() ?? null;
}

function getQuiz(quizId: string) {
  return db.select().from(quizzes).where(eq(quizzes.id, quizId)).get() ?? null;
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

function getParticipantList(sessionId: string): { id: string; displayName: string }[] {
  return db
    .select({ id: participants.id, displayName: participants.displayName })
    .from(participants)
    .where(eq(participants.sessionId, sessionId))
    .all();
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
  quiz: typeof quizzes.$inferSelect | null,
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
    totalQuestions: quizQuestions.length,
    answersVisible: Boolean(session.answersVisible),
    correctRevealed: Boolean(session.correctRevealed),
    timeLimit: quiz?.timeLimit ?? null,
    questionOpenedAt:
      session.phase === "question_open" ? session.questionOpenedAt ?? null : null,
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

function computeQuestionDistribution(
  sessionId: string,
  questionId: string
): {
  choices: { id: string; text: string; isCorrect: boolean }[];
  distribution: { choiceId: string; count: number }[];
  correctResponseCount: number;
} {
  const qChoices = getChoices([questionId]);
  const correctChoiceIds = qChoices
    .filter((c) => c.isCorrect === 1)
    .map((c) => c.id)
    .sort();
  const qResponses = db
    .select()
    .from(responses)
    .where(eq(responses.questionId, questionId))
    .all()
    .filter((r) => r.sessionId === sessionId);

  const distribution = qChoices.map((c) => ({
    choiceId: c.id,
    count: qResponses.filter((r) => {
      try {
        return (JSON.parse(r.choiceIds) as string[]).includes(c.id);
      } catch {
        return false;
      }
    }).length,
  }));

  // Compute correctness from choiceIds directly rather than the persisted
  // isCorrect column, so the count is accurate during question_open before
  // scoreQuestion runs on lock.
  const correctResponseCount = qResponses.filter((r) => {
    try {
      const ids = (JSON.parse(r.choiceIds) as string[]).slice().sort();
      return (
        ids.length === correctChoiceIds.length &&
        ids.every((id, i) => id === correctChoiceIds[i])
      );
    } catch {
      return false;
    }
  }).length;

  return {
    choices: qChoices.map((c) => ({ id: c.id, text: c.text, isCorrect: c.isCorrect === 1 })),
    distribution,
    correctResponseCount,
  };
}

function buildAdminState(
  session: typeof liveSessions.$inferSelect,
  quiz: typeof quizzes.$inferSelect | null,
  quizQuestions: (typeof questions.$inferSelect)[]
): AdminStatePayload {
  const participantCount = getParticipantCount(session.id);
  const question =
    session.phase !== "lobby" && session.phase !== "final"
      ? quizQuestions[session.currentQuestionIndex] ?? null
      : null;
  const responseCount = question ? getResponseCount(session.id, question.id) : 0;

  const hasQuestionStats =
    question &&
    (session.phase === "question_open" ||
      session.phase === "question_locked" ||
      session.phase === "results");
  const stats = hasQuestionStats ? computeQuestionDistribution(session.id, question.id) : null;
  // Choice texts / bar distribution are only meaningful after lock; during
  // open voting we keep the running Correct tally only to avoid spoiling the
  // bars on the shared screen.
  const showBars =
    question && (session.phase === "question_locked" || session.phase === "results");
  const dist = showBars ? stats : null;

  return {
    sessionId: session.id,
    phase: session.phase,
    currentQuestionIndex: session.currentQuestionIndex,
    totalQuestions: quizQuestions.length,
    answersVisible: Boolean(session.answersVisible),
    correctRevealed: Boolean(session.correctRevealed),
    status: session.status,
    participantCount,
    responseCount,
    totalParticipants: participantCount,
    timeLimit: quiz?.timeLimit ?? null,
    questionOpenedAt:
      session.phase === "question_open" ? session.questionOpenedAt ?? null : null,
    question: question
      ? { id: question.id, title: question.title, type: question.type, points: question.points }
      : null,
    participantList: session.phase === "lobby" ? getParticipantList(session.id) : undefined,
    choices: dist?.choices,
    distribution: dist?.distribution,
    correctResponseCount: stats?.correctResponseCount,
  };
}

function broadcastSessionState(
  io: SocketIOServer,
  session: typeof liveSessions.$inferSelect
) {
  const quiz = getQuiz(session.quizId);
  const quizQuestions = getQuestions(session.quizId);
  const allChoices = getChoices(quizQuestions.map((q) => q.id));

  // Broadcast common state (without personalized mySubmission) to all participants
  const statePayload = buildSessionState(session, quiz, quizQuestions, allChoices);
  io.to(`session:${session.code}`).emit("session:state", statePayload);

  // Admin state
  const adminPayload = buildAdminState(session, quiz, quizQuestions);
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

// ─── Auto-lock scheduler ────────────────────────────────────────────────────

function clearAutoLock(sessionId: string) {
  const handle = autoLockTimers.get(sessionId);
  if (handle) {
    clearTimeout(handle);
    autoLockTimers.delete(sessionId);
  }
}

function lockAndShowResults(io: SocketIOServer, sessionId: string) {
  const session = getSession(sessionId);
  if (!session || session.phase !== "question_open") return;

  db.update(liveSessions)
    .set({ phase: "results", answersVisible: 1, correctRevealed: 0 })
    .where(eq(liveSessions.id, session.id))
    .run();

  const quizQuestions = getQuestions(session.quizId);
  const currentQuestion = quizQuestions[session.currentQuestionIndex];
  if (currentQuestion) {
    scoreQuestion(currentQuestion.id, session.id);
    const { distribution } = computeQuestionDistribution(session.id, currentQuestion.id);
    io.to(`session:${session.code}`).emit("session:results", {
      questionId: currentQuestion.id,
      distribution,
    });
  }

  const updated = getSession(sessionId)!;
  broadcastSessionState(io, updated);
}

function autoLockQuestion(
  io: SocketIOServer,
  sessionId: string,
  expectedQuestionIndex: number
) {
  autoLockTimers.delete(sessionId);
  const session = getSession(sessionId);
  if (!session) return;
  if (session.phase !== "question_open") return;
  if (session.currentQuestionIndex !== expectedQuestionIndex) return;

  lockAndShowResults(io, sessionId);
}

function scheduleAutoLock(io: SocketIOServer, sessionId: string) {
  clearAutoLock(sessionId);
  const session = getSession(sessionId);
  if (!session || session.phase !== "question_open") return;
  const quiz = getQuiz(session.quizId);
  if (!quiz || !quiz.timeLimit || !session.questionOpenedAt) return;

  const expectedIndex = session.currentQuestionIndex;
  const deadline = session.questionOpenedAt + quiz.timeLimit * 1000;
  const delay = Math.max(0, deadline - Date.now());
  const handle = setTimeout(
    () => autoLockQuestion(io, sessionId, expectedIndex),
    delay
  );
  autoLockTimers.set(sessionId, handle);
}

// ─── Setup ───────────────────────────────────────────────────────────────────

export function setupSocketHandlers(io: SocketIOServer) {
  setIo(io);
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
      const quiz = getQuiz(session.quizId);
      const quizQuestions = getQuestions(session.quizId);
      const allChoices = getChoices(quizQuestions.map((q) => q.id));
      const state = buildSessionState(session, quiz, quizQuestions, allChoices, participant.id);
      socket.emit("session:state", state);
    });

    // ── Participant submit ──────────────────────────────────────────────────
    socket.on("participant:submit", (payload: ParticipantSubmitPayload) => {
      const { participantId, sessionId } = socket.data as { participantId?: string; sessionId?: string };
      if (!participantId || !sessionId) return;

      const session = getSession(sessionId);
      if (!session || session.phase !== "question_open") return;

      const quiz = getQuiz(session.quizId);
      if (quiz?.timeLimit && session.questionOpenedAt) {
        const deadline = session.questionOpenedAt + quiz.timeLimit * 1000 + GRACE_MS;
        if (Date.now() > deadline) {
          socket.emit("session:submit-rejected", {
            questionId: payload.questionId,
            reason: "time_expired",
          });
          return;
        }
      }

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
      const { correctResponseCount } = computeQuestionDistribution(
        sessionId,
        payload.questionId
      );
      io.to(`admin:${sessionId}`).emit("admin:response-count", {
        questionId: payload.questionId,
        count: responseCount,
        total: totalParticipants,
        correctCount: correctResponseCount,
      });
      // Also broadcast to participants so they can see live progress (without
      // the correctCount — that's admin-only).
      const sessionCode = (socket.data as { sessionCode?: string }).sessionCode;
      if (sessionCode) {
        io.to(`session:${sessionCode}`).emit("session:response-count", {
          questionId: payload.questionId,
          count: responseCount,
          total: totalParticipants,
        });
      }
    });

    // ── Admin join ──────────────────────────────────────────────────────────
    socket.on("admin:join", (payload: AdminJoinPayload) => {
      const session = getSession(payload.sessionId);
      if (!session) return;

      socket.join(`admin:${session.id}`);
      socket.data.adminSessionId = session.id;

      const quiz = getQuiz(session.quizId);
      const quizQuestions = getQuestions(session.quizId);
      const adminPayload = buildAdminState(session, quiz, quizQuestions);
      socket.emit("admin:state", adminPayload);
    });

    // ── Admin: next ─────────────────────────────────────────────────────────
    socket.on("admin:next", (payload: AdminActionPayload) => {
      const session = getSession(payload.sessionId);
      if (!session) return;

      if (session.phase === "lobby") {
        db.update(liveSessions)
          .set({
            phase: "question_open",
            currentQuestionIndex: 0,
            answersVisible: 0,
            correctRevealed: 0,
            questionOpenedAt: Date.now(),
          })
          .where(eq(liveSessions.id, session.id))
          .run();
      } else if (session.phase === "results") {
        const quizQuestions = getQuestions(session.quizId);
        const nextIndex = session.currentQuestionIndex + 1;
        if (nextIndex < quizQuestions.length) {
          db.update(liveSessions)
            .set({
              phase: "question_open",
              currentQuestionIndex: nextIndex,
              answersVisible: 0,
              correctRevealed: 0,
              questionOpenedAt: Date.now(),
            })
            .where(eq(liveSessions.id, session.id))
            .run();
        }
      }

      const updated = getSession(payload.sessionId)!;
      broadcastSessionState(io, updated);
      scheduleAutoLock(io, updated.id);
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
      const quiz = getQuiz(updated.quizId);
      const quizQuestions = getQuestions(updated.quizId);
      io.to(`admin:${session.id}`).emit("admin:state", buildAdminState(updated, quiz, quizQuestions));
    });

    // ── Admin: open-voting ──────────────────────────────────────────────────
    socket.on("admin:open-voting", (payload: AdminActionPayload) => {
      const session = getSession(payload.sessionId);
      if (!session || session.phase !== "question_locked") return;

      // Clear scoring so it is recomputed when voting locks again
      const quizQuestionsForReopen = getQuestions(session.quizId);
      const reopenQuestion = quizQuestionsForReopen[session.currentQuestionIndex];
      if (reopenQuestion) {
        db.update(responses)
          .set({ isCorrect: null, pointsEarned: null })
          .where(and(eq(responses.sessionId, session.id), eq(responses.questionId, reopenQuestion.id)))
          .run();
      }

      db.update(liveSessions)
        .set({ phase: "question_open", questionOpenedAt: Date.now() })
        .where(eq(liveSessions.id, session.id))
        .run();

      const updated = getSession(payload.sessionId)!;
      broadcastSessionState(io, updated);
      scheduleAutoLock(io, updated.id);
    });

    // ── Admin: back ────────────────────────────────────────────────────────
    socket.on("admin:back", (payload: AdminActionPayload) => {
      const session = getSession(payload.sessionId);
      if (!session) return;

      if (session.phase === "results") {
        db.update(liveSessions)
          .set({ phase: "question_locked", answersVisible: 0, correctRevealed: 0 })
          .where(eq(liveSessions.id, session.id))
          .run();
        const updated = getSession(payload.sessionId)!;
        broadcastSessionState(io, updated);
        return;
      }

      if (session.phase === "question_open") {
        clearAutoLock(session.id);
        const quizQuestions = getQuestions(session.quizId);
        const currentQuestion = quizQuestions[session.currentQuestionIndex];
        if (currentQuestion) {
          db.delete(responses)
            .where(and(eq(responses.sessionId, session.id), eq(responses.questionId, currentQuestion.id)))
            .run();
        }

        if (session.currentQuestionIndex === 0) {
          db.update(liveSessions)
            .set({ phase: "lobby", currentQuestionIndex: 0, answersVisible: 0, correctRevealed: 0, questionOpenedAt: null })
            .where(eq(liveSessions.id, session.id))
            .run();
          const updated = getSession(payload.sessionId)!;
          broadcastSessionState(io, updated);
        } else {
          const prevIndex = session.currentQuestionIndex - 1;
          db.update(liveSessions)
            .set({ phase: "results", currentQuestionIndex: prevIndex, answersVisible: 1, correctRevealed: 1, questionOpenedAt: null })
            .where(eq(liveSessions.id, session.id))
            .run();
          const updated = getSession(payload.sessionId)!;
          broadcastSessionState(io, updated);

          const prevQuestion = quizQuestions[prevIndex];
          if (prevQuestion) {
            const prevChoices = getChoices([prevQuestion.id]);
            const prevResponses = db
              .select()
              .from(responses)
              .where(eq(responses.questionId, prevQuestion.id))
              .all()
              .filter((r) => r.sessionId === session.id);

            const distribution = prevChoices.map((c) => ({
              choiceId: c.id,
              count: prevResponses.filter((r) => {
                try { return (JSON.parse(r.choiceIds) as string[]).includes(c.id); }
                catch { return false; }
              }).length,
            }));
            io.to(`session:${updated.code}`).emit("session:results", { questionId: prevQuestion.id, distribution });

            const correctChoiceIds = prevChoices.filter((c) => c.isCorrect === 1).map((c) => c.id);
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
                    .find((resp) => resp.questionId === prevQuestion.id && resp.sessionId === session.id);
                  if (r && r.isCorrect !== null) {
                    participantResult = { isCorrect: r.isCorrect === 1, pointsEarned: r.pointsEarned ?? 0 };
                  }
                }
                targetSocket.emit("session:correct", { questionId: prevQuestion.id, correctChoiceIds, participantResult });
              }
            }
          }
        }
        return;
      }
    });

    // ── Admin: lock-voting ──────────────────────────────────────────────────
    // Locking closes voting, scores responses, and reveals the answer
    // distribution (without marking correct/incorrect) so the admin can
    // discuss the results on the shared screen before revealing the answer.
    socket.on("admin:lock-voting", (payload: AdminActionPayload) => {
      const session = getSession(payload.sessionId);
      if (!session || session.phase !== "question_open") return;
      clearAutoLock(session.id);
      lockAndShowResults(io, session.id);
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
      clearAutoLock(session.id);

      db.update(liveSessions)
        .set({ status: "finished", finishedAt: Date.now() })
        .where(eq(liveSessions.id, session.id))
        .run();

      io.to(`session:${session.code}`).emit("session:ended", {});

      const updated = getSession(payload.sessionId)!;
      const quiz = getQuiz(updated.quizId);
      const quizQuestions = getQuestions(updated.quizId);
      io.to(`admin:${session.id}`).emit("admin:state", buildAdminState(updated, quiz, quizQuestions));
    });
  });

  // Boot recovery: re-schedule auto-lock for sessions currently in question_open
  const activeSessions = db
    .select()
    .from(liveSessions)
    .where(eq(liveSessions.phase, "question_open"))
    .all();
  for (const s of activeSessions) {
    scheduleAutoLock(io, s.id);
  }
}
