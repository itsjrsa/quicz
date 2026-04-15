import { db } from "../db";
import { responses, choices, questions } from "../db/schema";
import { eq } from "drizzle-orm";

export function scoreQuestion(questionId: string, sessionId: string): void {
  const question = db.select().from(questions).where(eq(questions.id, questionId)).get();
  if (!question) return;

  const allChoices = db.select().from(choices).where(eq(choices.questionId, questionId)).all();
  const correctChoiceIds = allChoices.filter((c) => c.isCorrect === 1).map((c) => c.id).sort();

  const questionResponses = db
    .select()
    .from(responses)
    .where(eq(responses.questionId, questionId))
    .all()
    .filter((r) => r.sessionId === sessionId);

  for (const response of questionResponses) {
    let submittedIds: string[] = [];
    try {
      submittedIds = (JSON.parse(response.choiceIds) as string[]).sort();
    } catch {
      submittedIds = [];
    }

    const isCorrect =
      submittedIds.length === correctChoiceIds.length &&
      submittedIds.every((id, i) => id === correctChoiceIds[i]);

    db.update(responses)
      .set({ isCorrect: isCorrect ? 1 : 0, pointsEarned: isCorrect ? question.points : 0 })
      .where(eq(responses.id, response.id))
      .run();
  }
}
