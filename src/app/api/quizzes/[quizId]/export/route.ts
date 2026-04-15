import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quizzes, questions, choices } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { isAdminAuthenticatedFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ quizId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  if (!isAdminAuthenticatedFromRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { quizId } = await params;
  const quiz = db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
  if (!quiz) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const quizQuestions = db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quizId))
    .orderBy(questions.order)
    .all();

  const questionIds = quizQuestions.map((q) => q.id);
  const allChoices =
    questionIds.length > 0
      ? db
          .select()
          .from(choices)
          .where(inArray(choices.questionId, questionIds))
          .orderBy(choices.order)
          .all()
      : [];

  const exportData = {
    title: quiz.title,
    description: quiz.description,
    questions: quizQuestions.map((q) => ({
      title: q.title,
      description: q.description,
      type: q.type,
      points: q.points,
      choices: allChoices
        .filter((c) => c.questionId === q.id)
        .map((c) => ({ text: c.text, isCorrect: Boolean(c.isCorrect) })),
    })),
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="quiz-${quizId}.json"`,
    },
  });
}
