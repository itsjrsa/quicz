# Security Policy

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Use one of the following private channels instead:

1. **Preferred — GitHub Security Advisories:** open a private report at
   <https://github.com/itsjrsa/quicz/security/advisories/new>.
2. **Alternative — email:** contact the maintainer via the address on the
   [@itsjrsa](https://github.com/itsjrsa) GitHub profile.

Please include enough detail for the issue to be reproduced (affected
version or commit, steps, expected vs. actual behaviour, and any
proof-of-concept). Avoid sharing exploit details in public channels until
a fix has been released.

## Scope

Quicz is a personal project maintained on a best-effort basis. Acknowledgements
and fixes are likewise best-effort, prioritising issues that affect the
default self-hosted deployment described in the docs (single Node process,
SQLite, admin auth via `ADMIN_PASSWORD` + `SESSION_SECRET`).

## Supported versions

Only the `master` branch is actively supported. Older tags or forks are
not patched.
