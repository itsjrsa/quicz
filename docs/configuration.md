---
icon: lucide/settings
---

# Configuration

All configuration is via environment variables. Copy `.env.example` to `.env`.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_PASSWORD` | ✅ | — | Password for the single admin account. |
| `SESSION_SECRET` | ✅ | — | Long random string used to HMAC-sign the admin cookie. |
| `DATABASE_URL` |  | `./data/quicz.db` | Path to the SQLite file. |
| `PORT` |  | `3000` | HTTP/WebSocket port. |
