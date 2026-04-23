---
icon: lucide/home
---

# Quicz

> **Quick Quiz** — a lean, self-hostable live quiz for the room you're already in. One code, one room, no signups.

Quicz is a live quiz application for training sessions and workshops. The admin drives the flow from a presenter panel; participants join with a 6-character code on any device — no account, no install.

![Main menu](screenshots/main-menu.png)

## At a glance

- One Node process, one port, one SQLite file.
- Single-choice, multiple-choice, and true/false questions.
- Admin-controlled reveal: distribution first, correct answer on demand.
- Per-participant correctness delivered privately.
- Final scoreboard with CSV export.
- Works offline on a LAN.

## Get it running

```bash
cp .env.example .env
docker compose up -d
```

Open <http://localhost:3000>. See [Install](install.md) for the non-Docker path and [Configuration](configuration.md) for environment variables.

## Next steps

- [Why Quicz?](why.md) — the design rationale
- [Usage](usage.md) — admin and participant walkthrough
- [Architecture](architecture.md) — how the pieces fit
- [Roadmap](roadmap.md) — known issues and what's missing
