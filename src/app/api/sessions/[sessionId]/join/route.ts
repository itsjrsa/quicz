import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { liveSessions, participants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getIo } from "@/lib/socket/io-ref";

type Params = { params: Promise<{ sessionId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { sessionId } = await params;

  const session = db.select().from(liveSessions).where(eq(liveSessions.id, sessionId)).get();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.status === "finished")
    return NextResponse.json({ error: "Session has ended" }, { status: 410 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.displayName !== "string" || body.displayName.trim() === "") {
    return NextResponse.json({ error: "displayName is required" }, { status: 400 });
  }

  // Reconnect: if participantId provided and exists, return it
  if (typeof body.participantId === "string") {
    const existing = db
      .select()
      .from(participants)
      .where(eq(participants.id, body.participantId))
      .get();
    if (existing && existing.sessionId === sessionId) {
      return NextResponse.json({ participantId: existing.id });
    }
  }

  // New participant
  const participant = {
    id: uuidv4(),
    sessionId,
    displayName: body.displayName.trim(),
    joinedAt: Date.now(),
  };

  db.insert(participants).values(participant).run();

  // Notify admins watching this session
  const io = getIo();
  io?.to(`admin:${sessionId}`).emit("admin:participant-joined", {
    participantId: participant.id,
    displayName: participant.displayName,
  });

  return NextResponse.json({ participantId: participant.id }, { status: 201 });
}
