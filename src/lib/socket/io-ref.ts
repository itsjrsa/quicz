// Lightweight io singleton accessor. Kept in its own module so consumers
// (e.g. REST route handlers) can reach the running io instance without
// pulling the full socket-handler graph (drizzle, db, scoring, ...).
import type { Server as SocketIOServer } from "socket.io";

const IO_KEY = Symbol.for("quicz.io");
type IoGlobal = typeof globalThis & { [IO_KEY]?: SocketIOServer };

export function getIo(): SocketIOServer | null {
  return (globalThis as IoGlobal)[IO_KEY] ?? null;
}

export function setIo(io: SocketIOServer) {
  (globalThis as IoGlobal)[IO_KEY] = io;
}
