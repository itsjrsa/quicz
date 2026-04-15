import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const COOKIE_NAME = "quicz_admin";
const TOKEN_VALUE = "authenticated"; // what we sign

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET env var is not set");
  return secret;
}

export function signToken(): string {
  const hmac = createHmac("sha256", getSecret());
  hmac.update(TOKEN_VALUE);
  const sig = hmac.digest("hex");
  return `${TOKEN_VALUE}.${sig}`;
}

export function verifyToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [value, sig] = parts;
  if (value !== TOKEN_VALUE) return false;
  const hmac = createHmac("sha256", getSecret());
  hmac.update(value);
  const expected = hmac.digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
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
