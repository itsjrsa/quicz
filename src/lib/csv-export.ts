import { db } from "@/db";
import { participants, responses, questions, choices } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function generateSessionCsv(sessionId: string): string {
  const sessionParticipants = db
    .select()
    .from(participants)
    .where(eq(participants.sessionId, sessionId))
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

  const questionIds = Array.from(new Set(sessionResponses.map((r) => r.questionId)));
  const sessionQuestions =
    questionIds.length > 0
      ? db.select().from(questions).where(inArray(questions.id, questionIds)).all()
      : [];

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
  const questionMap = new Map(sessionQuestions.map((q) => [q.id, q]));
  const participantMap = new Map(sessionParticipants.map((p) => [p.id, p]));

  const headers = [
    "participant_name",
    "participant_id",
    "question_id",
    "question_title",
    "question_type",
    "selected_answers",
    "correct",
    "points_earned",
    "submitted_at",
  ];

  const rows = sessionResponses.map((r) => {
    const participant = participantMap.get(r.participantId);
    const question = questionMap.get(r.questionId);
    const choiceIdList: string[] = (() => {
      try {
        return JSON.parse(r.choiceIds) as string[];
      } catch {
        return [];
      }
    })();
    const selectedAnswers = choiceIdList
      .map((id) => choiceMap.get(id)?.text ?? id)
      .join(";");

    return [
      escapeCsvField(participant?.displayName ?? ""),
      escapeCsvField(r.participantId),
      escapeCsvField(r.questionId),
      escapeCsvField(question?.title ?? ""),
      escapeCsvField(question?.type ?? ""),
      escapeCsvField(selectedAnswers),
      r.isCorrect === 1 ? "true" : "false",
      String(r.pointsEarned ?? 0),
      escapeCsvField(new Date(r.submittedAt).toISOString()),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}
