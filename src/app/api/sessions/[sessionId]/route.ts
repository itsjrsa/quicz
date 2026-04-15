import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { liveSessions, quizzes, questions, choices, participants } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { isAdminAuthenticatedFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ sessionId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  if (!isAdminAuthenticatedFromRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;
  const session = db.select().from(liveSessions).where(eq(liveSessions.id, sessionId)).get();
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const quiz = db.select().from(quizzes).where(eq(quizzes.id, session.quizId)).get();
  const quizQuestions = db
    .select()
    .from(questions)
    .where(eq(questions.quizId, session.quizId))
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

  const sessionParticipants = db
    .select()
    .from(participants)
    .where(eq(participants.sessionId, sessionId))
    .all();

  return NextResponse.json({
    ...session,
    quiz,
    questions: quizQuestions.map((q) => ({
      ...q,
      choices: allChoices.filter((c) => c.questionId === q.id),
    })),
    participantCount: sessionParticipants.length,
  });
}
