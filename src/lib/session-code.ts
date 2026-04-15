import { db } from "@/db";
import { liveSessions } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

export async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateCode();
    const existing = db
      .select({ id: liveSessions.id })
      .from(liveSessions)
      .where(and(eq(liveSessions.code, code), eq(liveSessions.status, "active")))
      .get();
    if (!existing) return code;
  }
  throw new Error("Failed to generate unique session code after 10 attempts");
}
