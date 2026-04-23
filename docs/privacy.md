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

- Participant endpoints (join, submit answer) and `POST /api/auth` are **not rate-limited**. On an untrusted network, anyone with a session code can spam joins or submissions, and anyone can brute-force the admin password at whatever rate the server accepts. Run Quicz on a LAN, behind a reverse proxy with rate limits, or on a private network if that matters.
- The admin cookie is HMAC-signed with `SESSION_SECRET`, carries a 7-day expiry embedded in the token, and authenticates both HTTP admin routes and live Socket.IO admin events. Logout (`DELETE /api/auth`) clears the cookie client-side and disconnects any open admin sockets, but the token itself remains valid until its `exp` — treat a leaked cookie as compromising admin access for the remainder of the week, and rotate `SESSION_SECRET` to invalidate every outstanding token at once.
- Put Quicz behind TLS (reverse proxy) in any deployment beyond `localhost` — the cookie is `Secure` in production but only useful if the transport is encrypted.
