import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { liveSessions } from "@/db/schema";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ code: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { code } = await params;

  const session = db
    .select()
    .from(liveSessions)
    .where(eq(liveSessions.code, code.toUpperCase()))
    .get();

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  return NextResponse.json({
    id: session.id,
    code: session.code,
    status: session.status,
    phase: session.phase,
  });
}
