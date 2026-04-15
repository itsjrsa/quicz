import { db } from "../db";
import { liveSessions, participants, responses, questions, choices } from "../db/schema";
import { eq, inArray, asc } from "drizzle-orm";

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function generateSessionCsv(sessionId: string): string {
  const session = db
    .select()
    .from(liveSessions)
    .where(eq(liveSessions.id, sessionId))
    .get();

  if (!session) {
    return "participant_name,participant_id,question_id,question_title,question_type,selected_answers,answered,correct,points_earned,submitted_at";
  }

  const sessionParticipants = db
    .select()
    .from(participants)
    .where(eq(participants.sessionId, sessionId))
    .orderBy(asc(participants.joinedAt))
    .all();

  const quizQuestions = db
    .select()
    .from(questions)
    .where(eq(questions.quizId, session.quizId))
    .orderBy(asc(questions.order))
    .all();

  const participantIds = sessionParticipants.map((p) => p.id);
  const sessionResponses =
    participantIds.length > 0
      ? db
          .select()
          .from(responses)
          .where(inArray(responses.participantId, participantIds))
          .all()
      : [];

  const responseMap = new Map(
    sessionResponses.map((r) => [`${r.participantId}::${r.questionId}`, r])
  );

  const choiceIds = sessionResponses.flatMap((r) => {
    try {
      return JSON.parse(r.choiceIds) as string[];
    } catch {
      return [];
    }
  });
  const uniqueChoiceIds = Array.from(new Set(choiceIds));
  const sessionChoices =
    uniqueChoiceIds.length > 0
      ? db.select().from(choices).where(inArray(choices.id, uniqueChoiceIds)).all()
      : [];
  const choiceMap = new Map(sessionChoices.map((c) => [c.id, c]));

  const headers = [
    "participant_name",
    "participant_id",
    "question_id",
    "question_title",
    "question_type",
    "selected_answers",
    "answered",
    "correct",
    "points_earned",
    "submitted_at",
  ];

  const rows: string[] = [];
  for (const participant of sessionParticipants) {
    for (const question of quizQuestions) {
      const response = responseMap.get(`${participant.id}::${question.id}`);

      if (response) {
        const choiceIdList: string[] = (() => {
          try {
            return JSON.parse(response.choiceIds) as string[];
          } catch {
            return [];
          }
        })();
        const selectedAnswers = choiceIdList
          .map((id) => choiceMap.get(id)?.text ?? id)
          .join(";");

        rows.push(
          [
            escapeCsvField(participant.displayName),
            escapeCsvField(participant.id),
            escapeCsvField(question.id),
            escapeCsvField(question.title),
            escapeCsvField(question.type),
            escapeCsvField(selectedAnswers),
            "true",
            response.isCorrect === 1 ? "true" : "false",
            String(response.pointsEarned ?? 0),
            escapeCsvField(new Date(response.submittedAt).toISOString()),
          ].join(",")
        );
      } else {
        rows.push(
          [
            escapeCsvField(participant.displayName),
            escapeCsvField(participant.id),
            escapeCsvField(question.id),
            escapeCsvField(question.title),
            escapeCsvField(question.type),
            "",
            "false",
            "false",
            "0",
            "",
          ].join(",")
        );
      }
    }
  }

  return [headers.join(","), ...rows].join("\n");
}
