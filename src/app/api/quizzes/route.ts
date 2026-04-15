import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quizzes } from "@/db/schema";
import { desc } from "drizzle-orm";
import { isAdminAuthenticatedFromRequest } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

export async function GET(req: NextRequest) {
  if (!isAdminAuthenticatedFromRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allQuizzes = db
    .select()
    .from(quizzes)
    .orderBy(desc(quizzes.createdAt))
    .all();

  return NextResponse.json(allQuizzes);
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticatedFromRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.title !== "string" || body.title.trim() === "") {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const now = Date.now();
  const quiz = {
    id: uuidv4(),
    title: body.title.trim(),
    description: typeof body.description === "string" ? body.description : null,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(quizzes).values(quiz).run();

  return NextResponse.json(quiz, { status: 201 });
}
