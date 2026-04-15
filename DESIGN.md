# Quicz — Design Specification

## Overview

Quicz is a lean, self-hostable, Mentimeter-inspired live quiz app for training sessions and workshops. It supports admin-controlled quiz flow with real-time audience participation, result display, and scoring.

This document describes the architecture, data model, route structure, realtime event model, and session lifecycle for the MVP.

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 15 (App Router) | Full-stack React, SSR for admin pages, single codebase |
| Language | TypeScript (strict) | Type safety across client, server, and socket events |
| Database | SQLite via `better-sqlite3` | Zero-config, file-based, ideal for self-hosting |
| ORM | Drizzle ORM | Lightweight, no codegen, SQL-close, excellent TS inference |
| Realtime | Socket.IO 4 on custom Node server | Bidirectional, rooms, auto-reconnect, polling fallback |
| Styling | Tailwind CSS 4 | Utility-first, fast iteration, minimal CSS output |
| Charts | Recharts | Clean React chart components, minimal config |
| Runtime | Node.js 20+ | LTS, stable, native fetch |

## Architecture

Single custom Node.js server (`server.ts`) that creates an HTTP server, attaches Socket.IO, and hands HTTP requests to Next.js. One process, one port.

**Why:** Simplest deployment story for self-hosting. WebSocket and HTTP share the same origin (no CORS). The Socket.IO server can directly import DB and business logic. Trade-off: loses `next start` — uses `node server.js` instead, which is equally simple in Docker.

## Project Structure

```
quicz/
├── server.ts                    # Custom HTTP + Socket.IO server entry
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── layout.tsx           # Root layout (fonts, global styles)
│   │   ├── page.tsx             # Landing / home
│   │   ├── join/
│   │   │   └── page.tsx         # Participant join page
│   │   ├── play/
│   │   │   └── [sessionCode]/
│   │   │       └── page.tsx     # Participant live session view
│   │   ├── admin/
│   │   │   ├── layout.tsx       # Admin layout (auth guard)
│   │   │   ├── login/
│   │   │   │   └── page.tsx     # Admin login
│   │   │   ├── quizzes/
│   │   │   │   ├── page.tsx     # Quiz list
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx # Create quiz
│   │   │   │   └── [quizId]/
│   │   │   │       ├── edit/
│   │   │   │       │   └── page.tsx  # Quiz editor
│   │   │   │       └── sessions/
│   │   │   │           └── page.tsx  # Session history for quiz
│   │   │   ├── sessions/
│   │   │   │   └── [sessionId]/
│   │   │   │       ├── present/
│   │   │   │       │   └── page.tsx  # Live presenter control
│   │   │   │       └── results/
│   │   │   │           └── page.tsx  # Session results/report
│   │   │   └── page.tsx         # Admin dashboard (redirect to quizzes)
│   │   └── api/
│   │       ├── auth/
│   │       │   └── route.ts     # Admin login/logout
│   │       ├── quizzes/
│   │       │   ├── route.ts     # CRUD quiz list
│   │       │   ├── [quizId]/
│   │       │   │   ├── route.ts # CRUD single quiz
│   │       │   │   └── import/
│   │       │   │       └── route.ts  # JSON import
│   │       │   └── export/
│   │       │       └── [quizId]/
│   │       │           └── route.ts  # JSON export
│   │       ├── sessions/
│   │       │   ├── route.ts     # Create session
│   │       │   ├── [sessionId]/
│   │       │   │   ├── route.ts # Session details
│   │       │   │   ├── join/
│   │       │   │   │   └── route.ts  # Participant join
│   │       │   │   └── export/
│   │       │   │       └── route.ts  # CSV export
│   │       │   └── by-code/
│   │       │       └── [code]/
│   │       │           └── route.ts  # Lookup session by code
│   │       └── health/
│   │           └── route.ts     # Health check
│   ├── db/
│   │   ├── schema.ts            # Drizzle schema (all tables)
│   │   ├── index.ts             # DB connection singleton
│   │   ├── seed.ts              # Demo/seed data
│   │   └── migrations/          # Drizzle migrations
│   ├── lib/
│   │   ├── socket/
│   │   │   ├── server.ts        # Socket.IO server setup + event handlers
│   │   │   ├── events.ts        # Shared event type definitions
│   │   │   └── client.ts        # React hook for Socket.IO client
│   │   ├── scoring.ts           # Score calculation logic
│   │   ├── session-code.ts      # Session code generation
│   │   ├── csv-export.ts        # CSV generation
│   │   ├── quiz-import.ts       # JSON import validation
│   │   └── auth.ts              # Admin auth helpers (cookie/session)
│   ├── components/
│   │   ├── ui/                  # Shared UI primitives
│   │   ├── admin/               # Admin-specific components
│   │   ├── participant/         # Participant-specific components
│   │   └── charts/              # Recharts wrappers
│   └── types/
│       └── index.ts             # Shared types
├── public/                      # Static assets
├── drizzle.config.ts            # Drizzle config
├── tailwind.config.ts           # Tailwind config
├── tsconfig.json
├── package.json
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## Data Model

### Quiz

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (text) | Primary key |
| title | text | Required |
| description | text | Optional |
| createdAt | integer (unix ms) | Auto-set |
| updatedAt | integer (unix ms) | Auto-set |

### Question

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (text) | Primary key |
| quizId | text | FK → Quiz.id, cascade delete |
| title | text | The question text |
| description | text | Optional additional context |
| type | text | `binary`, `single`, or `multi` |
| points | integer | Default 1 |
| order | integer | Position in quiz |

### Choice

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (text) | Primary key |
| questionId | text | FK → Question.id, cascade delete |
| text | text | The choice label |
| isCorrect | integer (bool) | 0 or 1 |
| order | integer | Position in choice list |

### LiveSession

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (text) | Primary key |
| quizId | text | FK → Quiz.id |
| code | text | 6-char uppercase alphanumeric, unique among active sessions |
| status | text | `active` or `finished` |
| currentQuestionIndex | integer | 0-based index |
| phase | text | `lobby`, `question_open`, `question_locked`, `results`, `final` |
| answersVisible | integer (bool) | Whether aggregated results are shown |
| correctRevealed | integer (bool) | Whether correct answer is shown |
| createdAt | integer (unix ms) | Auto-set |
| finishedAt | integer (unix ms) | Null until finished |

### Participant

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (text) | Primary key, stored in participant's localStorage |
| sessionId | text | FK → LiveSession.id |
| displayName | text | Not unique — UUID is identity |
| joinedAt | integer (unix ms) | Auto-set |

### Response

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (text) | Primary key |
| participantId | text | FK → Participant.id |
| sessionId | text | FK → LiveSession.id |
| questionId | text | FK → Question.id |
| choiceIds | text (JSON) | JSON array of choice UUIDs |
| isCorrect | integer (bool) | Null until scoring; 0 or 1 after |
| pointsEarned | integer | Null until scoring; 0+ after |
| submittedAt | integer (unix ms) | Auto-set |

Unique constraint on `(participantId, sessionId, questionId)` — one response per participant per question per session.

### Session code generation

6 uppercase characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (excludes O/0/I/1/L). Random, checked for uniqueness among active sessions.

## Route Structure

### Pages

| Route | Purpose | Auth |
|-------|---------|------|
| `/` | Landing page — intro, links to join + admin | Public |
| `/join` | Participant join form (session code + display name) | Public |
| `/play/[sessionCode]` | Participant live session view (all states) | Public |
| `/admin/login` | Admin login page | Public |
| `/admin` | Redirects to `/admin/quizzes` | Admin |
| `/admin/quizzes` | Quiz list (create, import, delete) | Admin |
| `/admin/quizzes/new` | Create new quiz (redirects to editor) | Admin |
| `/admin/quizzes/[quizId]/edit` | Quiz editor | Admin |
| `/admin/quizzes/[quizId]/sessions` | Session history for a quiz | Admin |
| `/admin/sessions/[sessionId]/present` | Live presenter control page | Admin |
| `/admin/sessions/[sessionId]/results` | Final results / report / CSV export | Admin |

### API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/auth` | Admin login (verify password, set cookie) |
| `DELETE` | `/api/auth` | Admin logout (clear cookie) |
| `GET` | `/api/quizzes` | List all quizzes |
| `POST` | `/api/quizzes` | Create a quiz |
| `GET` | `/api/quizzes/[quizId]` | Get quiz with questions + choices |
| `PUT` | `/api/quizzes/[quizId]` | Update quiz (full replace of questions/choices) |
| `DELETE` | `/api/quizzes/[quizId]` | Delete quiz |
| `POST` | `/api/quizzes/[quizId]/import` | Import quiz from JSON |
| `GET` | `/api/quizzes/[quizId]/export` | Export quiz as JSON |
| `POST` | `/api/sessions` | Create live session for a quiz |
| `GET` | `/api/sessions/[sessionId]` | Get session details |
| `GET` | `/api/sessions/by-code/[code]` | Lookup session by code |
| `POST` | `/api/sessions/[sessionId]/join` | Participant join |
| `GET` | `/api/sessions/[sessionId]/export` | Export session results as CSV |
| `GET` | `/api/health` | Health check |

### Admin Authentication

1. Single `ADMIN_PASSWORD` environment variable
2. `POST /api/auth` compares submitted password against env var
3. On match, sets an `HttpOnly` cookie with an HMAC-signed token (signed with `SESSION_SECRET` env var)
4. Admin layout checks cookie validity; invalid/missing → redirect to `/admin/login`
5. API routes for quiz/session management verify cookie in request handler
6. No user table, no database-stored credentials

## Realtime Event Model

All realtime communication uses Socket.IO. Event types are shared between client and server via `src/lib/socket/events.ts`.

### Connection & Rooms

- Admin connects and joins room `admin:{sessionId}`
- Participant connects and joins room `session:{sessionCode}`
- All participants in the same session share a room for broadcast

### Server → Participant Events

| Event | Payload | Trigger |
|-------|---------|---------|
| `session:state` | `{ phase, currentQuestionIndex, answersVisible, correctRevealed, question, choices }` | Full state sync on join/reconnect and every state change |
| `session:results` | `{ questionId, distribution: { choiceId, count }[] }` | Admin reveals aggregated results |
| `session:correct` | `{ questionId, correctChoiceIds[], participantResult: { isCorrect, pointsEarned } }` | Admin reveals correct answer (personalized per participant) |
| `session:scoreboard` | `{ rankings: { participantId, displayName, score, correctCount, rank }[] }` | Admin shows final scoreboard |
| `session:ended` | `{}` | Session finished |
| `participant:confirmed` | `{ participantId }` | Acknowledge join |

### Participant → Server Events

| Event | Payload | Trigger |
|-------|---------|---------|
| `participant:join` | `{ sessionCode, displayName, participantId? }` | Join or reconnect |
| `participant:submit` | `{ questionId, choiceIds[] }` | Submit or change answer |

### Admin → Server Events

| Event | Payload | Trigger |
|-------|---------|---------|
| `admin:join` | `{ sessionId }` | Admin connects to control session |
| `admin:next` | `{ sessionId }` | Next question |
| `admin:prev` | `{ sessionId }` | Previous question |
| `admin:open-voting` | `{ sessionId }` | Open voting for current question |
| `admin:lock-voting` | `{ sessionId }` | Lock voting |
| `admin:show-results` | `{ sessionId }` | Reveal aggregated results |
| `admin:show-correct` | `{ sessionId }` | Reveal correct answer |
| `admin:show-scoreboard` | `{ sessionId }` | Show final rankings |
| `admin:end-session` | `{ sessionId }` | End session |

### Server → Admin Events

| Event | Payload | Trigger |
|-------|---------|---------|
| `admin:state` | Full session state + participant count + response counts | State sync |
| `admin:participant-joined` | `{ participantId, displayName }` | New participant joined |
| `admin:response-count` | `{ questionId, count, total }` | Live submission counter |

### State Synchronization

The server is the single source of truth. Session state lives in the database. On any admin action:

1. Server updates session state in database
2. Server broadcasts `session:state` to all participants in the room
3. Server sends `admin:state` to the admin

On participant reconnect:

1. Client sends `participant:join` with stored `participantId`
2. Server finds existing participant + current session state + any existing response for current question
3. Server sends `session:state` with full current state including their submission status

## Session Lifecycle

### State Machine

```
lobby → question_open → question_locked → results → question_open (next Q) → ... → final
```

### Phase Transitions

| From | To | Trigger | Side Effects |
|------|----|---------|--------------|
| `lobby` | `question_open` | `admin:next` | Sets currentQuestionIndex to 0 |
| `question_open` | `question_locked` | `admin:lock-voting` | Computes `isCorrect` and `pointsEarned` for all responses to current question |
| `question_locked` | `results` | `admin:show-results` | Sets `answersVisible = true` |
| `results` | `results` | `admin:show-correct` | Sets `correctRevealed = true` (within same phase) |
| `results` | `question_open` | `admin:next` | Increments currentQuestionIndex, resets `answersVisible` and `correctRevealed` |
| `results` | `results` | `admin:prev` | Decrements currentQuestionIndex (admin-only review, no participant state rewind) |
| `results` | `final` | `admin:show-scoreboard` | Only after last question |
| `final` | — | `admin:end-session` | Sets status to `finished`, sets `finishedAt` |

### Scoring

- **Binary/Single:** `isCorrect = (submittedChoiceIds == correctChoiceIds)`. Points = `question.points` if correct, else `0`.
- **Multi:** `isCorrect = (submittedChoiceIds is exact set match with correctChoiceIds)`. Points = `question.points` if correct, else `0`.
- Scoring is computed server-side when voting locks.
- Unanswered questions earn 0 points (no Response row needed).

### Ranking

- Rank by total score descending (dense rank — ties share rank)
- Secondary sort: number of correct answers descending, then display name ascending

### Participant Reconnect

1. Client opens `/play/[sessionCode]`, checks localStorage for `participantId`
2. If found, sends `participant:join` with stored ID → server restores them to session room
3. Server sends `session:state` with current phase and their submission for the current question
4. If not found (new), server creates participant row, returns ID, client stores in localStorage
5. If session is `finished`, participant sees final scoreboard immediately

## Answer Submission Rules

- Participants may submit or change answers while phase is `question_open`
- Once phase is `question_locked`, submissions and changes are rejected
- Empty submissions are not allowed
- Unanswered questions receive 0 points
- Aggregated results may be shown before correct answer reveal
- Individual correctness is only shown after admin reveals correct answer

## Import/Export

### Quiz JSON Import

Simple JSON schema for importing quizzes:

```json
{
  "title": "My Quiz",
  "description": "Optional description",
  "questions": [
    {
      "title": "Is the sky blue?",
      "description": "Optional",
      "type": "binary",
      "points": 1,
      "choices": [
        { "text": "Yes", "isCorrect": true },
        { "text": "No", "isCorrect": false }
      ]
    }
  ]
}
```

### CSV Export

Per live session. Fields:

- participant_name
- participant_id
- question_id
- question_title
- question_type
- selected_answers (semicolon-separated choice texts)
- correct (true/false)
- points_earned
- submitted_at (ISO 8601)

## UI Direction

- Minimalist black-and-white interface
- Typography-first design with clean spacing
- Mobile-first participant UI, desktop-first admin UI
- One question per screen, slide-like flow
- Large tap targets on participant screens
- Color used mainly in charts, answer states, and correctness indicators
- Subtle motion only
- Strong contrast, keyboard-usable admin screens
- No reliance on color alone for correctness states (icons/text labels too)

## Environment Variables

```
ADMIN_PASSWORD=         # Required. Password for admin access.
SESSION_SECRET=         # Required. Secret for signing auth cookies.
DATABASE_URL=           # Optional. Defaults to ./data/quicz.db
PORT=                   # Optional. Defaults to 3000
```

## Implementation Phases

1. **Scaffold** — Project setup, database schema, seed data
2. **Quiz CRUD** — Quiz list, editor, question/choice management
3. **Live sessions** — Session creation, participant join, lobby
4. **Realtime sync** — Socket.IO integration, presenter controls, live question flow
5. **Results & scoring** — Score computation, result display, scoreboard, CSV export
6. **Polish** — UI refinement, import/export, README, Docker, self-host docs
