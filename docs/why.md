---
icon: lucide/lightbulb
---

# Why Quicz?

- **Self-hosted by design.** Everything runs in one Node process with a SQLite file. No managed service, no external API, no telemetry.
- **Offline-friendly.** Works on a laptop on a LAN with no internet connection — useful for workshops in rooms with flaky Wi-Fi.
- **No accounts.** Participants type a code and a display name. That's it.
- **Small surface area.** One binary, one port, one database file. Easy to audit, easy to back up, easy to throw away.
- **Open.** AGPL-licensed — if you fork it and run it as a service, your users get the source.

## Features

- Single-choice, multiple-choice, and binary (true/false) questions
- Optional per-question time limit with automatic lock
- Live answer-count indicator for participants
- Admin-controlled reveal: distribution first, correct answer on demand
- Per-participant correctness delivered privately (no leaking others' answers)
- Final scoreboard with top-10 cut and "where am I" indicator below the cut
- CSV export of all responses per session
- Keyboard navigation for participants (arrows + Enter)
- Light/dark theme

## Stack

| Framework | Language | Database | ORM | Realtime | Styling | Charts | Runtime |
|-----------|----------|----------|-----|----------|---------|--------|---------|
| Next.js 15 (App Router) | TypeScript (strict) | SQLite via `better-sqlite3` | Drizzle ORM | Socket.IO 4 | Tailwind CSS v4 | Recharts | Node.js 20+ |
