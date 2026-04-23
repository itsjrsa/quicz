import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./index";
import { logger } from "../lib/logger";

const log = logger.child({ scope: "db" });
const started = Date.now();
try {
  migrate(db, { migrationsFolder: "./src/db/migrations" });
  log.info("db.migrate.done", { durationMs: Date.now() - started });
} catch (err) {
  log.error("db.migrate.failed", {
    error: err instanceof Error ? err.message : String(err),
  });
  throw err;
}
