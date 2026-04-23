// Minimal structured logger. No dependencies.
//
// Format:
//   - production (NODE_ENV=production): one JSON object per line on stdout/stderr
//   - otherwise: human-readable single-line text on stdout/stderr
//
// Level is controlled by LOG_LEVEL (debug|info|warn|error|silent).
// Defaults: "debug" in development, "info" in production.
//
// Usage:
//   import { logger } from "@/lib/logger";
//   logger.info("server.ready", { port });
//   const log = logger.child({ scope: "socket", socketId });
//   log.warn("participant.rejected", { reason: "time_expired" });

type Level = "debug" | "info" | "warn" | "error";
type Ctx = Record<string, unknown>;

const LEVELS: Record<Level | "silent", number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

const isProd = process.env.NODE_ENV === "production";

function resolveLevel(): number {
  const raw = (process.env.LOG_LEVEL ?? "").toLowerCase();
  if (raw in LEVELS) return LEVELS[raw as keyof typeof LEVELS];
  return isProd ? LEVELS.info : LEVELS.debug;
}

const minLevel = resolveLevel();

const COLORS: Record<Level, string> = {
  debug: "\x1b[90m", // gray
  info: "\x1b[36m", // cyan
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
};
const RESET = "\x1b[0m";
const useColor = !isProd && process.stdout.isTTY;

function formatPretty(level: Level, msg: string, ctx: Ctx): string {
  const time = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
  const color = useColor ? COLORS[level] : "";
  const reset = useColor ? RESET : "";
  const tag = level.toUpperCase().padEnd(5);
  const scope = typeof ctx.scope === "string" ? ` [${ctx.scope}]` : "";
  const rest: Ctx = { ...ctx };
  delete rest.scope;
  const extras = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";
  return `${time} ${color}${tag}${reset}${scope} ${msg}${extras}`;
}

function formatJson(level: Level, msg: string, ctx: Ctx): string {
  return JSON.stringify({
    time: new Date().toISOString(),
    level,
    msg,
    ...ctx,
  });
}

function emit(level: Level, msg: string, ctx: Ctx) {
  if (LEVELS[level] < minLevel) return;
  const line = isProd ? formatJson(level, msg, ctx) : formatPretty(level, msg, ctx);
  if (level === "warn" || level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export interface Logger {
  debug(msg: string, ctx?: Ctx): void;
  info(msg: string, ctx?: Ctx): void;
  warn(msg: string, ctx?: Ctx): void;
  error(msg: string, ctx?: Ctx): void;
  child(ctx: Ctx): Logger;
}

function make(baseCtx: Ctx): Logger {
  return {
    debug: (msg, ctx) => emit("debug", msg, { ...baseCtx, ...ctx }),
    info: (msg, ctx) => emit("info", msg, { ...baseCtx, ...ctx }),
    warn: (msg, ctx) => emit("warn", msg, { ...baseCtx, ...ctx }),
    error: (msg, ctx) => emit("error", msg, { ...baseCtx, ...ctx }),
    child: (ctx) => make({ ...baseCtx, ...ctx }),
  };
}

export const logger: Logger = make({});
