import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quizzes, questions, choices } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { isAdminAuthenticatedFromRequest } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

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

  const questionsWithChoices = quizQuestions.map((q) => ({
    ...q,
    choices: allChoices.filter((c) => c.questionId === q.id),
  }));

  return NextResponse.json({ ...quiz, questions: questionsWithChoices });
}

export async function PUT(req: NextRequest, { params }: Params) {
  if (!isAdminAuthenticatedFromRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { quizId } = await params;

  const quiz = db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
  if (!quiz) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const now = Date.now();

  // Update quiz metadata
  db.update(quizzes)
    .set({
      title: body.title ?? quiz.title,
      description: body.description ?? quiz.description,
      timeLimit: body.timeLimit === undefined ? quiz.timeLimit : body.timeLimit,
      updatedAt: now,
    })
    .where(eq(quizzes.id, quizId))
    .run();

  // Full replace of questions + choices if provided
  if (Array.isArray(body.questions)) {
    // Delete existing questions (choices cascade)
    db.delete(questions).where(eq(questions.quizId, quizId)).run();

    for (let qi = 0; qi < body.questions.length; qi++) {
      const q = body.questions[qi];
      const questionId = q.id ?? uuidv4();
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

      if (Array.isArray(q.choices)) {
        for (let ci = 0; ci < q.choices.length; ci++) {
          const c = q.choices[ci];
          db.insert(choices)
            .values({
              id: c.id ?? uuidv4(),
              questionId,
              text: c.text,
              isCorrect: c.isCorrect ? 1 : 0,
              order: ci,
            })
            .run();
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!isAdminAuthenticatedFromRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { quizId } = await params;
  db.delete(quizzes).where(eq(quizzes.id, quizId)).run();

  return NextResponse.json({ ok: true });
}
