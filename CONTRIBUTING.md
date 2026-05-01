# Contributing to Quicz

Thanks for your interest in Quicz.

## Maintenance status

Quicz is a personal project maintained on a **best-effort basis**. It was
built for a specific set of training and workshop needs, and it is published
here so others can self-host it and learn from it. Development is occasional
rather than continuous.

**Pull requests are welcome.** New ideas, bug fixes, and improvements are
appreciated and will be reviewed as time allows. Response times are
best-effort, not guaranteed, and changes that expand scope beyond the core
"quick quiz for a room" use case may be declined.

## Before you open a PR

1. **Open an issue first** for anything non-trivial (new features, schema
   changes, dependency upgrades, UX rework). A short discussion up front
   saves everyone rework later.
2. **Small, focused PRs** merge fastest. Split unrelated changes into
   separate PRs.
3. **Keep the footprint small.** Quicz deliberately runs as a single Node
   process with SQLite. Proposals that require new runtime services
   (Redis, Postgres, a separate worker, etc.) are unlikely to land unless
   they are opt-in.
4. **Match the existing style.** TypeScript strict mode. ESLint
   (`eslint-config-next`) and Prettier are configured — run `npm run lint`
   and `npm run format` before opening a PR. A Husky pre-commit hook runs
   `lint-staged` and `npm run typecheck`; commits that don't pass are
   rejected.
5. **Read `DESIGN.md`** if you are touching socket events, the session
   phase machine, or the data model. It is the authoritative spec.

## Running locally

See the [Install](https://itsjrsa.github.io/quicz/install/) page in the docs,
or the Quickstart section in [`README.md`](./README.md).

## Commit and PR conventions

- Conventional-commit-style prefixes are preferred (`feat:`, `fix:`,
  `refactor:`, `docs:`, `chore:`). Scope is optional but helpful
  (`feat(presenter): …`).
- Do not add co-author or AI-attribution trailers to commit messages.
- PR descriptions should explain **why**, not just **what** — link the
  issue, describe the user-visible change, and list anything reviewers
  should pay special attention to.

## Reporting bugs

Open a GitHub issue with:

- What you did
- What you expected
- What actually happened
- Relevant environment details (Node version, browser, deployment mode)

## Security issues

Please do **not** open a public issue for security vulnerabilities. See
[`SECURITY.md`](./SECURITY.md) for private reporting channels (GitHub
Security Advisories or email).

## Licensing

Quicz is licensed under the GNU Affero General Public License v3.0 or later.
By submitting a contribution you agree that your work will be distributed
under the same license.
