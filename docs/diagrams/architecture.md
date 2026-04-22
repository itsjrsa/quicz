# Architecture

Quicz runs as a single Node.js process on a single port. A custom HTTP server
(`server.ts`) hosts both the Next.js request handler and a Socket.IO server,
sharing the same listener. SQLite (via Drizzle ORM and `better-sqlite3`) is
the single source of truth for session state; Socket.IO is used only as a
broadcast mechanism.

## Component diagram

```mermaid
flowchart LR
    subgraph Clients
      A[Admin browser<br/>/admin, /presenter]
      P[Participant browser<br/>/join, /play/:code]
    end

    subgraph Server["Node.js process (server.ts)"]
      direction TB
      H[HTTP listener<br/>single port]
      N[Next.js App Router<br/>pages + API routes]
      S[Socket.IO<br/>rooms: session:CODE, admin:ID]
      M[Drizzle migrations<br/>run at boot]
      T[autoLockTimers<br/>in-memory map]
    end

    DB[(SQLite<br/>WAL, FK on)]

    A -- HTTPS --> H
    P -- HTTPS --> H
    A -- WebSocket --> H
    P -- WebSocket --> H

    H --> N
    H --> S
    N <--> DB
    S <--> DB
    M --> DB
    S -.uses.-> T
```

## Session phase machine

```mermaid
stateDiagram-v2
    [*] --> lobby
    lobby --> question_open: admin:start / admin:next
    question_open --> question_locked: admin:lock-voting<br/>(or time limit)
    question_locked --> results: admin:show-results
    results --> results: admin:reveal-correct<br/>(sets correctRevealed)
    results --> question_open: admin:next (more questions)
    results --> final: admin:show-final
    final --> [*]
```

See `DESIGN.md` for the full event and payload reference.
