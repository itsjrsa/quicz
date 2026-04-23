import { NextRequest, NextResponse } from "next/server";
import {
  signToken,
  verifyAdminPassword,
  COOKIE_NAME_EXPORT as COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth";
import { getIo } from "@/lib/socket/io-ref";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const { password } = body;

  if (!password || !verifyAdminPassword(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = signToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export async function DELETE(_req: NextRequest) {
  // Kill any live admin websocket(s). Single-admin model: disconnecting every
  // socket with isAdmin=true is correct — one logout invalidates all admin tabs.
  const io = getIo();
  if (io) {
    for (const socket of io.sockets.sockets.values()) {
      if (socket.data?.isAdmin === true) socket.disconnect(true);
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
