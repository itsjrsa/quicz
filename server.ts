// Must load before anything that pulls in Next's app-render runtime: it
// polyfills globalThis.AsyncLocalStorage on Node < 22, which Next's
// async-local-storage.js captures at module-load time.
import "next/dist/server/node-environment-baseline";

import { createServer, IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./src/db";
import { setupSocketHandlers } from "./src/lib/socket/server";
import { logger } from "./src/lib/logger";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);

const log = logger.child({ scope: "server" });

const migrateStarted = Date.now();
try {
  migrate(db, { migrationsFolder: "./src/db/migrations" });
  log.info("db.migrate.done", { durationMs: Date.now() - migrateStarted });
} catch (err) {
  log.error("db.migrate.failed", {
    error: err instanceof Error ? err.message : String(err),
  });
  throw err;
}

const app = next({ dev });
const handle = app.getRequestHandler();

// Log every unhandled rejection / uncaught exception so we have a crumb trail
// before the process exits. Don't swallow — rethrow semantics unchanged.
process.on("unhandledRejection", (reason) => {
  log.error("process.unhandledRejection", {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});
process.on("uncaughtException", (err) => {
  log.error("process.uncaughtException", { error: err.message, stack: err.stack });
});

app.prepare().then(() => {
  const httpLog = logger.child({ scope: "http" });

  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    const start = Date.now();
    const { method, url } = req;
    // Path without query string, for log hygiene (query can contain PII).
    const parsedUrl = parse(req.url!, true);
    const path = parsedUrl.pathname ?? url ?? "";

    res.on("finish", () => {
      const durationMs = Date.now() - start;
      const status = res.statusCode;
      const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
      httpLog[level]("http.request", { method, path, status, durationMs });
    });

    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    cors: { origin: dev ? "*" : false },
  });
  setupSocketHandlers(io);

  httpServer.listen(port, () => {
    log.info("server.ready", { port, env: process.env.NODE_ENV ?? "development" });
  });
});
