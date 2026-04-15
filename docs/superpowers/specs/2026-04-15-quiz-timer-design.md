# Quiz-Level Per-Question Timer

**Status:** Design approved — ready for implementation plan
**Date:** 2026-04-15

## Summary

Add an optional quiz-level timer that applies to every question in the quiz. When a question opens, a countdown runs for all participants and the presenter. When it expires, the server automatically locks the question (phase `question_open` → `question_locked`) and rejects late response submissions. The presenter still controls reveal and advance manually. Scoring is unchanged.

Quizzes without a configured timer behave exactly as today.

## Scope

**In scope**

- Quiz-level `timeLimit` (seconds), configured in the editor
- Server-authoritative countdown anchored to `questionOpenedAt`
- Automatic phase transition to `question_locked` on expiry, driven by the socket server
- Server-side rejection of late responses with a 1s grace window
- Client countdown display on presenter and participant views
- Graceful behavior on server restart mid-question

**Out of scope**

- Per-question timer overrides
- Auto-reveal or auto-advance on expiry
- Point decay / speed-based scoring
- Pausing or extending the timer during a question

## Data model

Two schema changes (single Drizzle migration, both columns nullable so existing data is unaffected):

1. **`quizzes.timeLimit`** — `integer` (nullable). Seconds per question. `NULL` means no timer.
2. **`liveSessions.questionOpenedAt`** — `integer` (nullable, unix ms). Set when phase transitions to `question_open`; used by server-side expiry checks and client countdowns.

## Editor UX

`src/components/admin/QuizEditor.tsx` gains one control near the quiz title/description header: a small "Time per question (seconds)" input. Empty or `0` means no timer. The value is included in the `PUT /api/quizzes/[id]` save payload. No per-question controls and no new editor section.

## Server behavior

All changes live in `src/lib/socket/server.ts`, which already owns phase transitions.

### Auto-lock scheduler

- Maintain an in-memory `Map<sessionId, Timeout>` for pending auto-lock timers.
- When the phase transitions to `question_open` (both the start-quiz path around line 320 and the next-question path around line 328):
  - Set `questionOpenedAt = Date.now()` on the session row.
  - If the quiz has a `timeLimit`, schedule `setTimeout(() => autoLock(sessionId), timeLimit * 1000)` and store the handle.
- `autoLock(sessionId)`:
  - Re-read the session. No-op if phase is no longer `question_open` or the current question index has changed (presenter may have locked or advanced manually).
  - Update phase to `question_locked` and broadcast the new session state to all clients in the session room.
- On any manual transition out of `question_open` (lock, next, reset): clear and delete the pending timer from the map.

### Server boot recovery

On socket server startup, enumerate active sessions. For each session in phase `question_open` whose quiz has a `timeLimit`:

- If `Date.now() >= questionOpenedAt + timeLimit * 1000`: run `autoLock` immediately.
- Otherwise: schedule `setTimeout` for the remaining duration.

### Response acceptance (late-submission rejection)

In the existing submit handler (around line 249), in addition to the current `phase === "question_open"` check:

- If the quiz has a `timeLimit` and `questionOpenedAt` is set:
  - Compute `deadline = questionOpenedAt + timeLimit * 1000 + GRACE_MS` where `GRACE_MS = 1000`.
  - Reject the response if `Date.now() > deadline`.
- `GRACE_MS` is a named constant defined once in the socket server module.

Responses that arrive within the grace but after the auto-lock phase transition are still accepted (the deadline is evaluated against `questionOpenedAt`, not against phase).

## Client behavior

### Socket payload

Extend `SessionStatePayload` in `src/lib/socket/events.ts`:

```ts
timeLimit: number | null;        // seconds, from the quiz
questionOpenedAt: number | null; // unix ms, from the session
```

Both fields are populated from the joined quiz/session rows in the existing `buildSessionState`-style helper.

### Countdown calculation

Both presenter and participant compute remaining seconds the same way:

```
remaining = max(0, timeLimit - (Date.now() - questionOpenedAt) / 1000)
```

This anchors every client to the same server timestamp, eliminating drift from when each client received the state update.

### Presenter view

A small countdown badge near the current question header. Informational only — presenter keeps manual lock, reveal, and next controls. When the server broadcasts the auto-locked state, the UI transitions via the normal state update path.

### Participant view

A countdown near the question. When it hits 0 locally, the submit button is disabled as visual feedback. The server is still authoritative — actual acceptance is governed by the grace window.

### Timer-off behavior

When `timeLimit` is null, neither client renders a countdown and neither disables submission on any timer. Behavior matches the current app exactly.

## Error handling & edge cases

- **Late submission after grace:** server returns an error; participant sees a toast "Time's up" and the submit button stays disabled.
- **Participant joins mid-question:** they receive the current `questionOpenedAt` and compute their own remaining time. If already 0, they wait for the next question.
- **Clock skew between clients:** tolerated by the 1s grace window and by anchoring countdowns to `questionOpenedAt` from the server.
- **Presenter locks manually before expiry:** the pending timer is cleared; `autoLock` would no-op anyway because the phase check fails.
- **Server restart mid-question:** recovery logic in "Server boot recovery" handles both expired and in-flight timers.
- **Quiz edited mid-session:** out of scope — `timeLimit` used for a session is whatever the quiz had when the session was created; the server reads it fresh on each `question_open` transition, so we document that editing a live quiz's timer is unsupported.

## Testing

- **Unit:** late-submission rejection logic — boundary cases around `questionOpenedAt + timeLimit*1000 + GRACE_MS`.
- **Unit:** `autoLock` no-op when phase has already moved on.
- **Integration (manual or playwright):**
  - Create a quiz with a 10s timer, start a session, verify auto-lock fires and broadcasts.
  - Submit a response just after expiry (within grace) — accepted.
  - Submit well after expiry — rejected with user-visible error.
  - Create a quiz with no timer — verify no countdown renders and no auto-lock occurs.
  - Restart the socket server while a question is open — verify the timer resumes or locks correctly depending on remaining time.

## Files touched (non-exhaustive)

- `src/db/schema.ts` — two new nullable columns
- `src/db/migrations/` — one new migration
- `src/components/admin/QuizEditor.tsx` — time-limit input
- `src/app/api/quizzes/[id]/route.ts` — persist `timeLimit` in PUT
- `src/lib/socket/events.ts` — extend `SessionStatePayload`
- `src/lib/socket/server.ts` — scheduler, recovery, late-submission check
- `src/components/admin/PresenterView.tsx` — countdown badge
- `src/components/participant/` — countdown + submit disable on expiry
