---
icon: lucide/map
---

# Known Issues & Roadmap

Quicz is maintained on a best-effort basis — development is occasional rather than continuous. The items below are known gaps; they may or may not be addressed on any particular timeline. PRs are welcome (see [`CONTRIBUTING.md`](https://github.com/itsjrsa/quicz/blob/master/CONTRIBUTING.md)).

- Socket.IO room membership is lost if the server restarts mid-session. Session state survives in SQLite, but participants will need to reconnect and questions may need to be manually re-locked by the admin.
- No rate limiting on join or answer submission endpoints.
- No pagination on quiz list or session history — fine for typical workshop scale, not for thousands of sessions.
