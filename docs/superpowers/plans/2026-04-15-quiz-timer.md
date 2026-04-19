# Quiz Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional quiz-level per-question timer that auto-locks questions on expiry and rejects late submissions server-side, with countdown UI for presenter and participants.

**Architecture:** Schema gains `quizzes.timeLimit` and `liveSessions.questionOpenedAt`. The socket server owns an in-memory `Map<sessionId, Timeout>` of pending auto-lock timers, schedules one whenever a question opens, and re-schedules on boot for active sessions. Late-submission rejection uses `questionOpenedAt + timeLimit*1000 + 1000ms grace`. Clients compute remaining time locally from `questionOpenedAt` broadcast in session state.

**Tech Stack:** Next.js, TypeScript, Drizzle ORM, better-sqlite3, Socket.IO, Tailwind, React.

**Testing note:** This project has no automated test framework today. Verification in each task uses manual browser/network steps. Do not introduce a test runner as part of this plan.

## File map

- **Create** `src/db/migrations/0001_quiz_timer.sql` — new Drizzle migration adding two nullable columns.
- **Modify** `src/db/schema.ts` — add `timeLimit` to `quizzes`, `questionOpenedAt` to `liveSessions`.
- **Modify** `src/app/api/quizzes/[quizId]/route.ts` — persist `timeLimit` in PUT and return it in GET (already returned via spread).
- **Modify** `src/components/admin/QuizEditor.tsx` — add time-limit input in the header.
- **Modify** `src/lib/socket/events.ts` — extend `SessionStatePayload` with `timeLimit`, `questionOpenedAt`.
- **Modify** `src/lib/socket/server.ts` — scheduler map, `autoLockQuestion`, boot recovery, late-submission check, set `questionOpenedAt` on open transitions, include timer fields in `buildSessionState`.
- **Modify** `src/components/admin/PresenterView.tsx` — countdown badge.
- **Modify** `src/components/participant/PlayView.tsx` — countdown + disable submit on local expiry, handle rejection feedback.

---

### Task 1: Schema + migration

**Files:**
- Modify: `src/db/schema.ts`
- Create: `src/db/migrations/0001_quiz_timer.sql` (via `db:generate`)

- [ ] **Step 1: Add `timeLimit` column to `quizzes` table**

In `src/db/schema.ts`, change the `quizzes` table definition to add `timeLimit` after `description`:

```ts
export const quizzes = sqliteTable("quizzes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  timeLimit: integer("time_limit"),
  createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at").notNull().$defaultFn(() => Date.now()),
});
```

- [ ] **Step 2: Add `questionOpenedAt` column to `liveSessions` table**

In `src/db/schema.ts`, change the `liveSessions` table definition to add `questionOpenedAt` after `correctRevealed`:

```ts
export const liveSessions = sqliteTable("live_sessions", {
  id: text("id").primaryKey(),
  quizId: text("quiz_id")
    .notNull()
    .references(() => quizzes.id),
  code: text("code").notNull().unique(),
  status: text("status", { enum: ["active", "finished"] })
    .notNull()
    .default("active"),
  currentQuestionIndex: integer("current_question_index").notNull().default(0),
  phase: text("phase", {
    enum: ["lobby", "question_open", "question_locked", "results", "final"],
  })
    .notNull()
    .default("lobby"),
  answersVisible: integer("answers_visible").notNull().default(0),
  correctRevealed: integer("correct_revealed").notNull().default(0),
  questionOpenedAt: integer("question_opened_at"),
  createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
  finishedAt: integer("finished_at"),
});
```

- [ ] **Step 3: Generate the migration**

Run: `npm run db:generate`

Expected: a new file appears in `src/db/migrations/` with `ALTER TABLE quizzes ADD time_limit INTEGER;` and `ALTER TABLE live_sessions ADD question_opened_at INTEGER;`. Rename it to `0001_quiz_timer.sql` if the generator picked a different name, and update `src/db/migrations/meta/_journal.json` accordingly (drizzle-kit handles this automatically — only rename if needed for clarity).

- [ ] **Step 4: Apply the migration**

The project's dev server (`npm run dev`) runs `src/db/migrate.ts` on startup. Restart it if running. Alternatively, run the migration script directly if available.

Verify with: `sqlite3 data/quicz.db ".schema quizzes"` and `".schema live_sessions"` — both new columns must appear.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/db/migrations/
git commit -m "feat(db): add timeLimit to quizzes and questionOpenedAt to live_sessions"
```

---

### Task 2: Persist `timeLimit` in the quiz API

**Files:**
- Modify: `src/app/api/quizzes/[quizId]/route.ts`
- Modify: `src/app/api/quizzes/route.ts` (if POST also accepts timeLimit — verify)

- [ ] **Step 1: Update PUT handler to persist `timeLimit`**

In `src/app/api/quizzes/[quizId]/route.ts`, change the `db.update(quizzes).set({...})` call inside `PUT` to include `timeLimit`:

```ts
db.update(quizzes)
  .set({
    title: body.title ?? quiz.title,
    description: body.description ?? quiz.description,
    timeLimit:
      body.timeLimit === undefined ? quiz.timeLimit : body.timeLimit,
    updatedAt: now,
  })
  .where(eq(quizzes.id, quizId))
  .run();
```

The `body.timeLimit === undefined` check preserves the existing value when clients omit the field. Clients sending `null` will clear the timer.

- [ ] **Step 2: Check POST handler in `src/app/api/quizzes/route.ts`**

Open `src/app/api/quizzes/route.ts` and, if it has a POST that creates quizzes from a body, add `timeLimit: body.timeLimit ?? null` to the insert. If quiz creation is only from a template or import, skip this step — `timeLimit` defaults to NULL via the nullable column.

- [ ] **Step 3: Verify GET returns the field**

GET already returns `...quiz`, which now includes `timeLimit` automatically via the Drizzle inferred type. No change required.

- [ ] **Step 4: Manual verification**

Start dev server, open an existing quiz in the admin, save it with the normal save button (no timer field yet — that comes in Task 3). Confirm no error. Then run:

```bash
sqlite3 data/quicz.db "SELECT id, title, time_limit FROM quizzes;"
```

Expected: all rows show `time_limit` as NULL.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/quizzes/
git commit -m "feat(api): persist quiz timeLimit on PUT"
```

---

### Task 3: Editor UI — time limit input

**Files:**
- Modify: `src/components/admin/QuizEditor.tsx`

- [ ] **Step 1: Add `timeLimit` to the `QuizData` interface and component state**

At the top of `src/components/admin/QuizEditor.tsx`, update the `QuizData` interface:

```ts
interface QuizData {
  id: string;
  title: string;
  description: string | null;
  timeLimit: number | null;
  questions: Question[];
}
```

Inside the `QuizEditor` function, add state near the existing `title`/`description` state:

```ts
const [timeLimit, setTimeLimit] = useState<number | null>(initialData.timeLimit ?? null);
```

Update `savedSnapshot`, `currentSnapshot`, and `handleSave` to include `timeLimit`:

```ts
const [savedSnapshot, setSavedSnapshot] = useState(() =>
  JSON.stringify({
    title: initialData.title,
    description: initialData.description ?? "",
    timeLimit: initialData.timeLimit ?? null,
    questions: initialData.questions,
  })
);
const currentSnapshot = useMemo(
  () => JSON.stringify({ title, description, timeLimit, questions }),
  [title, description, timeLimit, questions]
);
```

In `handleSave`, include `timeLimit` in the PUT body and in the new snapshot:

```ts
body: JSON.stringify({
  title,
  description: description || null,
  timeLimit,
  questions,
}),
```

```ts
setSavedSnapshot(JSON.stringify({ title, description, timeLimit, questions }));
```

- [ ] **Step 2: Render the time-limit input in the header**

In the header JSX, below the description input, add:

```tsx
<div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
  <label htmlFor="quiz-time-limit">Time per question (seconds)</label>
  <input
    id="quiz-time-limit"
    type="number"
    min={0}
    value={timeLimit ?? ""}
    onChange={(e) => {
      const v = e.target.value;
      if (v === "") {
        setTimeLimit(null);
      } else {
        const n = parseInt(v, 10);
        setTimeLimit(Number.isFinite(n) && n > 0 ? n : null);
      }
    }}
    placeholder="no timer"
    className="w-20 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-black"
  />
</div>
```

Empty string and `0` both map to `null` (no timer).

- [ ] **Step 3: Ensure the admin quiz page passes `timeLimit` into `initialData`**

Open `src/app/admin/(protected)/quizzes/[quizId]/page.tsx` (or the equivalent route serving `QuizEditor`). Verify the data fetched from `GET /api/quizzes/[quizId]` is passed through unchanged — since the API now returns `timeLimit`, no code change is usually needed. If the page maps fields explicitly, add `timeLimit: quiz.timeLimit ?? null`.

Run: `grep -n "initialData" src/app/admin -r`

Inspect the result and add `timeLimit` explicitly if the page constructs the prop from specific fields.

- [ ] **Step 4: Manual verification**

Start `npm run dev`, open a quiz, set the time-limit field to `30`, click Save. Then:

```bash
sqlite3 data/quicz.db "SELECT id, title, time_limit FROM quizzes;"
```

Expected: the edited quiz shows `time_limit = 30`. Clear the input, save again — expected: `time_limit` is NULL.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/QuizEditor.tsx src/app/admin
git commit -m "feat(editor): add per-quiz time limit input"
```

---

### Task 4: Socket events payload

**Files:**
- Modify: `src/lib/socket/events.ts`

- [ ] **Step 1: Extend `SessionStatePayload`**

In `src/lib/socket/events.ts`, add two fields to `SessionStatePayload`:

```ts
export interface SessionStatePayload {
  phase: "lobby" | "question_open" | "question_locked" | "results" | "final";
  currentQuestionIndex: number;
  totalQuestions: number;
  answersVisible: boolean;
  correctRevealed: boolean;
  timeLimit: number | null;
  questionOpenedAt: number | null;
  question: {
    id: string;
    title: string;
    description: string | null;
    type: "binary" | "single" | "multi";
    points: number;
  } | null;
  choices: { id: string; text: string }[];
  mySubmission: string[] | null;
}
```

- [ ] **Step 2: Add a new server-to-client event for submission rejection**

Add a new exported type:

```ts
export interface SubmitRejectedPayload {
  questionId: string;
  reason: "time_expired";
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/socket/events.ts
git commit -m "feat(socket): add timeLimit, questionOpenedAt, submit rejection event"
```

---

### Task 5: Socket server — scheduler, open transitions, rejection

**Files:**
- Modify: `src/lib/socket/server.ts`

- [ ] **Step 1: Import the `quizzes` table and define constants**

Near the top of `src/lib/socket/server.ts`, add `quizzes` to the schema imports:

```ts
import {
  liveSessions,
  participants,
  responses,
  questions,
  choices,
  quizzes,
} from "../../db/schema";
```

Below the imports, add:

```ts
const GRACE_MS = 1000;
const autoLockTimers = new Map<string, NodeJS.Timeout>();
```

- [ ] **Step 2: Add a helper to fetch the quiz row**

Below `getSession`, add:

```ts
function getQuiz(quizId: string) {
  return db.select().from(quizzes).where(eq(quizzes.id, quizId)).get() ?? null;
}
```

- [ ] **Step 3: Update `buildSessionState` to include timer fields**

`buildSessionState` currently takes `session`, `quizQuestions`, `allChoices`. Change its signature to also accept `quiz` (or look it up inside). Add a parameter:

```ts
function buildSessionState(
  session: typeof liveSessions.$inferSelect,
  quiz: typeof quizzes.$inferSelect | null,
  quizQuestions: (typeof questions.$inferSelect)[],
  allChoices: (typeof choices.$inferSelect)[],
  participantId?: string
): SessionStatePayload {
```

At the end of `buildSessionState`, include in the returned object:

```ts
return {
  phase: session.phase as SessionStatePayload["phase"],
  currentQuestionIndex: session.currentQuestionIndex,
  totalQuestions: quizQuestions.length,
  answersVisible: Boolean(session.answersVisible),
  correctRevealed: Boolean(session.correctRevealed),
  timeLimit: quiz?.timeLimit ?? null,
  questionOpenedAt:
    session.phase === "question_open" ? session.questionOpenedAt ?? null : null,
  question: /* unchanged */,
  choices: questionChoices,
  mySubmission,
};
```

Update every call site of `buildSessionState` to pass the quiz row:

- Inside `broadcastSessionState`: after fetching `quizQuestions`, also fetch `const quiz = getQuiz(session.quizId);` and pass it.
- Inside the `participant:join` handler: same — fetch the quiz and pass it.

- [ ] **Step 4: Add `scheduleAutoLock` and `autoLockQuestion` helpers**

Above `setupSocketHandlers`, add:

```ts
function clearAutoLock(sessionId: string) {
  const handle = autoLockTimers.get(sessionId);
  if (handle) {
    clearTimeout(handle);
    autoLockTimers.delete(sessionId);
  }
}

function autoLockQuestion(io: SocketIOServer, sessionId: string, expectedQuestionIndex: number) {
  autoLockTimers.delete(sessionId);
  const session = getSession(sessionId);
  if (!session) return;
  if (session.phase !== "question_open") return;
  if (session.currentQuestionIndex !== expectedQuestionIndex) return;

  db.update(liveSessions)
    .set({ phase: "question_locked" })
    .where(eq(liveSessions.id, session.id))
    .run();

  const quizQuestions = getQuestions(session.quizId);
  const currentQuestion = quizQuestions[session.currentQuestionIndex];
  if (currentQuestion) {
    scoreQuestion(currentQuestion.id, session.id);
  }

  const updated = getSession(sessionId)!;
  broadcastSessionState(io, updated);
}

function scheduleAutoLock(io: SocketIOServer, sessionId: string) {
  clearAutoLock(sessionId);
  const session = getSession(sessionId);
  if (!session || session.phase !== "question_open") return;
  const quiz = getQuiz(session.quizId);
  if (!quiz || !quiz.timeLimit || !session.questionOpenedAt) return;

  const expectedIndex = session.currentQuestionIndex;
  const deadline = session.questionOpenedAt + quiz.timeLimit * 1000;
  const delay = Math.max(0, deadline - Date.now());
  const handle = setTimeout(() => autoLockQuestion(io, sessionId, expectedIndex), delay);
  autoLockTimers.set(sessionId, handle);
}
```

Note: `autoLockQuestion` mirrors the manual `admin:lock-voting` behavior — it also calls `scoreQuestion` so the lock is fully equivalent.

- [ ] **Step 5: Set `questionOpenedAt` and schedule auto-lock on every open transition**

In the `admin:next` handler, replace both `db.update(liveSessions).set({ phase: "question_open", ... })` calls to also set `questionOpenedAt: Date.now()`:

```ts
if (session.phase === "lobby") {
  db.update(liveSessions)
    .set({
      phase: "question_open",
      currentQuestionIndex: 0,
      answersVisible: 0,
      correctRevealed: 0,
      questionOpenedAt: Date.now(),
    })
    .where(eq(liveSessions.id, session.id))
    .run();
} else if (session.phase === "results") {
  const quizQuestions = getQuestions(session.quizId);
  const nextIndex = session.currentQuestionIndex + 1;
  if (nextIndex < quizQuestions.length) {
    db.update(liveSessions)
      .set({
        phase: "question_open",
        currentQuestionIndex: nextIndex,
        answersVisible: 0,
        correctRevealed: 0,
        questionOpenedAt: Date.now(),
      })
      .where(eq(liveSessions.id, session.id))
      .run();
  }
}

const updated = getSession(payload.sessionId)!;
broadcastSessionState(io, updated);
scheduleAutoLock(io, updated.id);
```

In the `admin:open-voting` handler (which re-opens a locked question), also set `questionOpenedAt` and schedule:

```ts
db.update(liveSessions)
  .set({ phase: "question_open", questionOpenedAt: Date.now() })
  .where(eq(liveSessions.id, session.id))
  .run();

const updated = getSession(payload.sessionId)!;
broadcastSessionState(io, updated);
scheduleAutoLock(io, updated.id);
```

- [ ] **Step 6: Clear the timer on manual transitions out of `question_open`**

In the `admin:lock-voting` handler, add `clearAutoLock(session.id);` at the start of the handler (after the guard checks). Example:

```ts
socket.on("admin:lock-voting", (payload: AdminActionPayload) => {
  const session = getSession(payload.sessionId);
  if (!session || session.phase !== "question_open") return;
  clearAutoLock(session.id);

  db.update(liveSessions)
    .set({ phase: "question_locked" })
    .where(eq(liveSessions.id, session.id))
    .run();
  /* ... rest unchanged ... */
});
```

In the `admin:end-session` handler, also call `clearAutoLock(session.id);` after the guard.

- [ ] **Step 7: Reject late submissions**

In the `participant:submit` handler, after the existing `phase !== "question_open"` guard, add the expiry check:

```ts
const session = getSession(sessionId);
if (!session || session.phase !== "question_open") return;

const quiz = getQuiz(session.quizId);
if (quiz?.timeLimit && session.questionOpenedAt) {
  const deadline = session.questionOpenedAt + quiz.timeLimit * 1000 + GRACE_MS;
  if (Date.now() > deadline) {
    socket.emit("session:submit-rejected", {
      questionId: payload.questionId,
      reason: "time_expired",
    });
    return;
  }
}

if (!Array.isArray(payload.choiceIds) || payload.choiceIds.length === 0) return;
/* ... rest unchanged ... */
```

- [ ] **Step 8: Boot recovery**

At the very end of `setupSocketHandlers`, before the closing brace, add:

```ts
// Boot recovery: re-schedule auto-lock for sessions currently in question_open
const activeSessions = db
  .select()
  .from(liveSessions)
  .where(eq(liveSessions.phase, "question_open"))
  .all();
for (const s of activeSessions) {
  scheduleAutoLock(io, s.id);
}
```

- [ ] **Step 9: Manual verification**

Start `npm run dev`. Create a quiz with 10s time limit and 1 question. Start a session, join as a participant in a second browser, click Start Quiz in the presenter.

1. **Countdown expires → auto-lock:** wait 10 seconds without submitting. Expected: presenter and participant views both transition to the locked state automatically (still without countdown UI in this task — we'll add it in Task 6/7). You should see this in the server logs if logging is enabled; otherwise open the admin page and verify the phase changed.

2. **Manual lock cancels auto-lock:** repeat, but click Lock Voting manually before 10s. Expected: no errors, state transitions normally. Run:
   ```bash
   sqlite3 data/quicz.db "SELECT phase, question_opened_at FROM live_sessions ORDER BY created_at DESC LIMIT 1;"
   ```
   Expected: `phase = question_locked`.

3. **Late submission rejected:** create a quiz with 5s limit. Join as participant. Wait 7s (past grace). Try to submit. In the browser console, expect no response update; optionally in the DevTools Network/Socket inspector you should see a `session:submit-rejected` event.

4. **Boot recovery:** start a session with a long timer (60s). Kill the dev server mid-question and restart it. Expected: the timer still fires at approximately the original deadline.

- [ ] **Step 10: Commit**

```bash
git add src/lib/socket/server.ts
git commit -m "feat(socket): auto-lock questions on timer expiry and reject late submissions"
```

---

### Task 6: Presenter countdown badge

**Files:**
- Modify: `src/components/admin/PresenterView.tsx`

- [ ] **Step 1: Read current PresenterView**

Open `src/components/admin/PresenterView.tsx` and locate where the current question title/header is rendered (likely inside a block that renders when `state.phase === "question_open"` or similar).

- [ ] **Step 2: Add a local countdown hook**

Inside the component function, above the JSX return, add:

```ts
const [now, setNow] = useState(() => Date.now());
useEffect(() => {
  if (!state || state.timeLimit == null || state.questionOpenedAt == null) return;
  if (state.phase !== "question_open") return;
  const interval = setInterval(() => setNow(Date.now()), 250);
  return () => clearInterval(interval);
}, [state?.phase, state?.timeLimit, state?.questionOpenedAt]);

const remainingSeconds =
  state && state.timeLimit != null && state.questionOpenedAt != null
    ? Math.max(0, Math.ceil((state.questionOpenedAt + state.timeLimit * 1000 - now) / 1000))
    : null;
```

Make sure `useState` and `useEffect` are imported from React at the top of the file.

- [ ] **Step 3: Render the countdown badge near the question header**

Where the presenter currently displays the current question title, add:

```tsx
{remainingSeconds != null && state?.phase === "question_open" && (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium tabular-nums ${
      remainingSeconds <= 5 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"
    }`}
    aria-live="polite"
  >
    {remainingSeconds}s
  </span>
)}
```

- [ ] **Step 4: Manual verification**

Dev server running, create a quiz with a 30s timer, start a session, open the presenter view. Expected: a badge near the question counts down from 30 and turns red at ≤5s. When the timer hits 0, the state transitions to locked and the badge disappears.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/PresenterView.tsx
git commit -m "feat(presenter): countdown badge for timed questions"
```

---

### Task 7: Participant countdown + late-submit feedback

**Files:**
- Modify: `src/components/participant/PlayView.tsx`

- [ ] **Step 1: Add countdown state and effect**

At the top of the `PlayView` function, next to the existing `useState` calls, add:

```ts
const [now, setNow] = useState(() => Date.now());
const [rejected, setRejected] = useState(false);
```

Below the other `useEffect` hooks, add:

```ts
useEffect(() => {
  if (!state || state.timeLimit == null || state.questionOpenedAt == null) return;
  if (state.phase !== "question_open") return;
  const interval = setInterval(() => setNow(Date.now()), 250);
  return () => clearInterval(interval);
}, [state?.phase, state?.timeLimit, state?.questionOpenedAt]);
```

Compute `remainingSeconds` below the state declarations:

```ts
const remainingSeconds =
  state && state.timeLimit != null && state.questionOpenedAt != null
    ? Math.max(0, Math.ceil((state.questionOpenedAt + state.timeLimit * 1000 - now) / 1000))
    : null;
const timeUp = remainingSeconds === 0;
```

- [ ] **Step 2: Handle the submit-rejected event**

Inside the existing socket-effect that registers listeners, add:

```ts
const handleSubmitRejected = (_payload: { questionId: string; reason: string }) => {
  setRejected(true);
  setSubmitted(false);
};
socket.on("session:submit-rejected", handleSubmitRejected);
```

And in the cleanup at the end of that effect, add:

```ts
socket.off("session:submit-rejected", handleSubmitRejected);
```

Also clear `rejected` whenever a new question opens — in the existing `handleState`, inside the `phase === "question_open"` branch, add `setRejected(false);`.

- [ ] **Step 3: Render the countdown and disable submit on expiry**

Above the question/choices block, add:

```tsx
{remainingSeconds != null && state?.phase === "question_open" && (
  <div
    className={`text-center text-sm font-medium mb-3 tabular-nums ${
      remainingSeconds <= 5 ? "text-red-600" : "text-gray-600"
    }`}
    aria-live="polite"
  >
    {remainingSeconds}s left
  </div>
)}
```

Find the existing Submit button and change its `disabled` prop to also factor in `timeUp`:

```tsx
<button
  disabled={/* existing conditions */ || timeUp}
  /* ... */
>
  {timeUp ? "Time's up" : /* existing label */}
</button>
```

Below the submit button, show the rejection notice:

```tsx
{rejected && (
  <div className="mt-2 text-xs text-red-600">
    Time&apos;s up — your answer was not accepted.
  </div>
)}
```

- [ ] **Step 4: Manual verification**

Create a quiz with a 10s timer. Join as participant in one browser, start session from admin in another.

1. **Normal submission within time:** select an answer, submit. Expected: accepted, mySubmission persists.
2. **Expiry disables button:** wait 10s without submitting. Expected: countdown reaches 0, submit button label changes to "Time's up" and is disabled.
3. **Submission just before expiry (within grace):** reset and try to submit at ~t=10.5s. Expected: server still accepts (within 1s grace). No rejection notice.
4. **Submission after grace:** if you can provoke a submit attempt after t > 11s (e.g., by keeping the button briefly clickable via DevTools), expect `session:submit-rejected` to fire and the red notice to appear.

- [ ] **Step 5: Commit**

```bash
git add src/components/participant/PlayView.tsx
git commit -m "feat(participant): countdown, submit disable on expiry, rejection notice"
```

---

### Task 8: Final smoke check

- [ ] **Step 1: Quiz with no timer behaves unchanged**

Create or edit a quiz without setting a time limit. Start a session, go through all phases. Expected: no countdown rendered on either view, submissions always accepted, presenter controls work as before.

- [ ] **Step 2: Quiz with timer — full flow**

Create a quiz with 15s timer and 3 questions. Run a session with one participant.

- Q1: submit within time — should be counted as correct/wrong normally.
- Q2: let timer expire — should auto-lock; participant sees "Time's up"; presenter can then show results and advance.
- Q3: submit just at expiry — should be accepted via grace.

Expected: scoreboard at the end reflects responses from Q1 and Q3 only.

- [ ] **Step 3: Commit (if any cleanup changes)**

Only commit if you touched files during smoke testing. Otherwise skip.

---

## Self-review notes

- **Spec coverage:** Schema (Task 1), API persist (Task 2), Editor UX (Task 3), Socket payload (Task 4), Server scheduler/recovery/rejection (Task 5), Presenter countdown (Task 6), Participant countdown + rejection (Task 7), Smoke check (Task 8). All sections from the spec covered.
- **Type consistency:** `timeLimit`, `questionOpenedAt`, `GRACE_MS`, `autoLockTimers`, `scheduleAutoLock`, `autoLockQuestion`, `clearAutoLock`, `getQuiz` — names are consistent across tasks.
- **Testing compromise:** The spec mentioned unit tests, but this project has no test framework. Verification is manual. If adding automated tests is desired later, that's a separate plan.
