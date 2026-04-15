import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quizzes, questions, choices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isAdminAuthenticatedFromRequest } from "@/lib/auth";
import { validateImportedQuiz } from "@/lib/quiz-import";
import { v4 as uuidv4 } from "uuid";

type Params = { params: Promise<{ quizId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  if (!isAdminAuthenticatedFromRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { quizId } = await params;
  const quiz = db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
  if (!quiz) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);

  try {
    const imported = validateImportedQuiz(body);
    const now = Date.now();

    db.update(quizzes)
      .set({ title: imported.title, description: imported.description ?? null, updatedAt: now })
      .where(eq(quizzes.id, quizId))
      .run();

    db.delete(questions).where(eq(questions.quizId, quizId)).run();

    for (let qi = 0; qi < imported.questions.length; qi++) {
      const q = imported.questions[qi];
      const questionId = uuidv4();
      db.insert(questions)
        .values({
          id: questionId,
          quizId,
          title: q.title,
          description: q.description ?? null,
          type: q.type,
          points: q.points ?? 1,
          order: qi,
        })
        .run();

      for (let ci = 0; ci < q.choices.length; ci++) {
        db.insert(choices)
          .values({
            id: uuidv4(),
            questionId,
            text: q.choices[ci].text,
            isCorrect: q.choices[ci].isCorrect ? 1 : 0,
            order: ci,
          })
          .run();
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid quiz data" },
      { status: 400 }
    );
  }
}
