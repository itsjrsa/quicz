import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const COOKIE_NAME = "quicz_admin";
const TOKEN_PREFIX = "authenticated";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET env var is not set");
  return secret;
}

function hmacHex(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function signToken(nowMs: number = Date.now()): string {
  const exp = Math.floor(nowMs / 1000) + SESSION_MAX_AGE_SECONDS;
  const value = `${TOKEN_PREFIX}:${exp}`;
  return `${exp}.${hmacHex(value)}`;
}

export function verifyToken(token: string, nowMs: number = Date.now()): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [expStr, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Math.floor(nowMs / 1000)) return false;

  const expected = hmacHex(`${TOKEN_PREFIX}:${exp}`);
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Timing-safe password comparison. Hashes both sides to equalize length. */
export function verifyAdminPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("ADMIN_PASSWORD env var is not set");
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Use in Server Components and middleware (reads cookies()) */
export async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return false;
    return verifyToken(token);
  } catch {
    return false;
  }
}

/** Use in API Route handlers (reads from request) */
export function isAdminAuthenticatedFromRequest(req: NextRequest): boolean {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyToken(token);
}

export const COOKIE_NAME_EXPORT = COOKIE_NAME;
