import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { liveSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isAdminAuthenticatedFromRequest } from "@/lib/auth";
import { generateSessionCsv } from "@/lib/csv-export";

type Params = { params: Promise<{ sessionId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  if (!isAdminAuthenticatedFromRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;
  const session = db.select().from(liveSessions).where(eq(liveSessions.id, sessionId)).get();
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const csv = generateSessionCsv(sessionId);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="session-${session.code}.csv"`,
    },
  });
}
