---
icon: lucide/shield
---

# Data & Privacy

- All data is stored locally in the SQLite file at `DATABASE_URL`. Nothing is sent to third parties.
- No telemetry, no analytics, no external tracking scripts.
- Sessions, participants, and responses persist in the database until you delete them. There is no automatic retention policy — back up or wipe `data/quicz.db` as you see fit.

## Admin access model

Quicz has a **single admin role, authenticated by one shared `ADMIN_PASSWORD`**. There are no user accounts, roles, or audit trails — anyone who knows the password has full control over every quiz, session, and export. Treat `ADMIN_PASSWORD` like a root password: pick a long random value, rotate it if it may have been exposed, and do not share it between deployments.

## Exposure surface

- Participant endpoints (join, submit answer) are **not rate-limited**. If the server is reachable from an untrusted network, expect that anyone with a valid session code can spam joins or submissions. Run Quicz on a LAN, behind a reverse proxy with rate limits, or on a private network if that matters.
- The admin cookie is HMAC-signed with `SESSION_SECRET` and transmitted over whatever transport you terminate the server on. Put Quicz behind TLS (reverse proxy) in any deployment beyond `localhost`.
