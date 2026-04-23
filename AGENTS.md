# Agent Guidance

This file provides codebase guidance for AI coding assistants (Claude Code, opencode, etc.).

## Commands

```bash
npm run dev          # tsx watch server.ts — runs custom server (NOT `next dev`)
npm run build        # next build + tsc -p tsconfig.server.json (emits dist/server.js)
npm run start        # node dist/server.js — production entry
npm run lint         # next lint (ESLint + eslint-config-next)
npm run lint:fix     # next lint --fix
npm run format       # prettier --write .
npm run format:check # prettier --check .
npm run typecheck    # tsc --noEmit for both tsconfig.json and tsconfig.server.json
npm run db:generate  # drizzle-kit generate (after schema.ts changes)
npm run db:migrate   # manual migrate via src/db/migrate.ts
npm run db:studio    # drizzle-kit studio
```

No test runner is configured. ESLint (`eslint-config-next` with `core-web-vitals` + `typescript` presets) and Prettier are wired in. Husky runs a pre-commit hook that invokes `lint-staged` (eslint + prettier on staged files) and `npm run typecheck` for the full project — commits that don't pass get rejected.

Migrations run automatically at server boot (`server.ts` calls `migrate(...)` before `app.prepare()`), so `db:migrate` is rarely needed manually.

Required env vars (see `.env.example`): `ADMIN_PASSWORD`, `SESSION_SECRET`. Optional: `DATABASE_URL` (default `./data/quicz.db`), `PORT` (default `3000`), `LOG_LEVEL` (`debug`|`info`|`warn`|`error`|`silent`; defaults to `debug` in dev, `info` in prod).

## Logging

Structured logger lives in `src/lib/logger.ts` — no external deps. It emits JSON lines when `NODE_ENV=production`, human-readable text otherwise. Use `logger.child({ scope, ... })` to tag lines; prefer dotted event names (`http.request`, `participant.join`, `session.broadcast`). HTTP requests are logged in `server.ts`; socket events and phase transitions in `src/lib/socket/server.ts`. Don't log secrets, cookies, or request bodies.

## Architecture

**One process, one port.** `server.ts` is a custom Node HTTP server that (1) runs Drizzle migrations, (2) hands HTTP to Next.js via `app.getRequestHandler()`, and (3) attaches a Socket.IO server to the same HTTP listener. This is why `next dev`/`next start` are not used — WebSockets must share the HTTP server. Two TS configs exist for this split: `tsconfig.json` (Next build, excludes `server.ts`) and `tsconfig.server.json` (emits `dist/server.js`).

**Source of truth is SQLite.** All session state (phase, current question, flags) lives in the `live_sessions` row. Socket.IO is a broadcast mechanism, not a state store. Every admin action writes to the DB first, then `broadcastSessionState()` fans out `session:state` to participants and `admin:state` to admins. Participant reconnects rebuild full state from the DB using the `participantId` held in localStorage.

**In-memory exception:** `autoLockTimers` (`src/lib/socket/server.ts`) is a `Map<sessionId, Timeout>` for time-limited questions. This is the one piece of state that does not survive restart — timers are lost and questions must be manually locked by the admin after a restart.

**Rooms.** Participants join room `session:{CODE}`; admins join `admin:{sessionId}`. These are disjoint so personalized vs. aggregated payloads can be targeted.

**Scoring is server-side.** When `admin:lock-voting` fires, `scoreQuestion()` computes `isCorrect`/`pointsEarned` for every response row. Multi-choice requires exact set match. Individual correctness is gated behind the `correctRevealed` flag and delivered via `session:correct` per-participant (not broadcast).

**Session phase machine:** `lobby → question_open → question_locked → results → (next) question_open → ... → final`. See `DESIGN.md` for the full transition table. `results` is a sub-state — `answersVisible` and `correctRevealed` are flags within it, set by separate admin events.

## Layout conventions

- Admin auth: single `ADMIN_PASSWORD` env var. `POST /api/auth` sets an HMAC-signed cookie (`quicz_admin`) signed with `SESSION_SECRET`. No user table. Server Components use `isAdminAuthenticated()` (reads `cookies()`); API route handlers use `isAdminAuthenticatedFromRequest(req)`.
- Admin routes live under `src/app/admin/(protected)/` — the route group's `layout.tsx` enforces auth. Public admin pages (`login`, dashboard redirect) live directly under `src/app/admin/`.
- Shared realtime types are in `src/lib/socket/events.ts` and imported by both `server.ts` socket handlers and the React client hook in `src/lib/socket/client.ts`. Keep payload shapes in sync across both sides when editing.
- Socket.IO client opens with `transports: ["polling", "websocket"]` (polling first, upgrades to WebSocket). This order is intentional — don't drop `polling`.
- DB access uses Drizzle with `better-sqlite3` (synchronous). `journal_mode=WAL` and `foreign_keys=ON` are set in `src/db/index.ts`.
- Path alias: `@/*` → `src/*` (configured in both tsconfigs).

## Docs

- `DESIGN.md` — authoritative spec for data model, routes, socket events, phase transitions. Consult before changing socket payloads or DB schema.
- `docs/` — Markdown source for the user-facing docs site (Zensical; `zensical.toml`). Covers why, install, usage, architecture, privacy, roadmap. `site/` is the generated static build — never edit by hand.
- `README.md` — short landing page pointing to the docs site.
- `CONTRIBUTING.md` — contributor workflow.
