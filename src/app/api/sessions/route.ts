import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { liveSessions, quizzes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isAdminAuthenticatedFromRequest } from "@/lib/auth";
import { generateUniqueCode } from "@/lib/session-code";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticatedFromRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.quizId !== "string") {
    return NextResponse.json({ error: "quizId is required" }, { status: 400 });
  }

  const quiz = db.select().from(quizzes).where(eq(quizzes.id, body.quizId)).get();
  if (!quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 });

  const code = await generateUniqueCode();
  const now = Date.now();

  const session = {
    id: uuidv4(),
    quizId: body.quizId,
    code,
    status: "active" as const,
    currentQuestionIndex: 0,
    phase: "lobby" as const,
    answersVisible: 0,
    correctRevealed: 0,
    createdAt: now,
    finishedAt: null,
  };

  db.insert(liveSessions).values(session).run();

  return NextResponse.json(session, { status: 201 });
}
