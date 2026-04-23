# Quicz

> **Quick Quiz** — a lean, self-hostable live quiz for the room you're already in. One code, one room, no signups.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![Docs](https://img.shields.io/badge/docs-zensical-0ea5e9.svg)](https://itsjrsa.github.io/quicz/)

![Main menu](docs/screenshots/main-menu.png)

## Quickstart

```bash
cp .env.example .env
docker compose up -d
```

Open <http://localhost:3000>. Admin lives at `/admin` (set `ADMIN_PASSWORD` first). Participants join with a 6-character code.

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_PASSWORD` | ✅ | — | Password for the single admin account. |
| `SESSION_SECRET` | ✅ | — | Long random string used to HMAC-sign the admin cookie. |
| `DATABASE_URL` |  | `./data/quicz.db` | Path to the SQLite file. |
| `PORT` |  | `3000` | HTTP/WebSocket port. |

## Docs

Full documentation: **<https://itsjrsa.github.io/quicz/>** — why Quicz, local install, usage walkthrough, architecture, data & privacy, roadmap.

Contributor-facing docs stay in the repo:

- [`DESIGN.md`](./DESIGN.md) — authoritative spec: data model, socket events, phase transitions.
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — how to contribute.
- [`CLAUDE.md`](./CLAUDE.md) — conventions for AI coding assistants working on this repo.

## License

[GNU Affero General Public License v3.0 or later](./LICENSE). If you modify Quicz and run it as a network service, you must make your source available to its users.
