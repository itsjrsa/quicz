# Quicz — UI/UX Review

Audit of the current Quicz interface, scoped to **minimalist + polish**: keep
the black/white/gray direction, tighten type, spacing, and details. No new
accent color, no redesign.

## 1. Guiding principles

The app is intentionally minimalist — this audit respects that. Recommendations
below are "polish the existing direction," not "redesign." The bar for adding
visual noise is high; the bar for removing friction is low.

Three cross-cutting threads surface repeatedly:

1. **Typography is generic.** No custom font; system default. A minimalist app
   lives or dies on type — a single custom display/body pair would lift every
   screen at once.
2. **No shared primitives.** Buttons, inputs, and cards are re-implemented
   inline with near-identical Tailwind class strings. Drift is already visible
   (e.g. `rounded-xl` vs `rounded-md`; `border-gray-200` vs `border-gray-100`).
3. **Focus/hover states are understated.** Keyboard users and power users get
   little feedback. Cheap to fix, big quality bump.

## 2. Landing page — `src/app/page.tsx`

**Current:** centered 5xl "Quicz" + tagline + two stacked buttons on white.

**Observations:**

- The name "Quicz" is never explained. First-time visitors see a made-up word
  and a generic tagline. A one-word gloss ("Quick Quiz.") would land the joke.
- Typography is the flat part. `font-bold tracking-tight` on a system font
  reads as a prototype, not a product.
- CTA hierarchy is fine (filled vs outlined), but the outlined "Admin" button
  competes for attention at the same width as "Join a Quiz." Most visitors are
  participants — admin is a corner-of-screen concern.
- No footer, no indication this is open source / self-hosted / who made it.
  Not required, but a single small line would give the page a floor.

**Polish-level recommendations:**

- Add `next/font` display pair: e.g. **Geist** (body) + **Geist Mono** (for the
  session code UI throughout the app) — matches the current aesthetic, free,
  self-hosted, no layout shift. Or Inter + JetBrains Mono if Geist feels
  overused.
- Brand gloss under the wordmark: `Quicz` as the h1, then tiny uppercase
  tracked label `QUICK · QUIZ` under it, then the tagline below.
- De-emphasize "Admin" — move to a small top-right text link (or bottom
  footer) rather than an equal-weight button. Landing becomes a single clear
  CTA: "Join a Quiz." Presenters know where admin is.
- Add an "Enter session code" shortcut directly on the landing page (optional):
  skips one tap. The join flow already accepts `?code=XXXXXX`, so a tiny code
  input here would feed straight through.
- Subtle backdrop: one very low-contrast element — a radial gradient, a dotted
  grid, or a single large faded "?" mark. No hero image, no illustration.

## 3. Participant flow

### Join — `src/app/join/page.tsx`

- Good: auto-advance on 6 chars, QR `?code=` support, remembers name per
  session. These are real UX wins already.
- **Label placement:** "Session Code" label above a centered monospace input
  feels fine, but the `XXXXXX` placeholder is shouty. Consider `------` or
  `· · · · · ·` as a softer hint, or six individual character boxes (Apple
  verification-code style) — the latter is a classic "stylish minimalism"
  move and fits the monospace theme already in place.
- **Error copy:** "Session not found. Check the code and try again." is good.
  "This session has already ended." — consider adding a small CTA or link
  back home instead of a dead end.
- **Name step:** no validation feedback on duplicate names within a session
  (the server allows them, which is fine, but a heads-up if someone else has
  the same name could be nice — out of scope for this pass).

### Lobby — `PlayView.tsx` (lobby branch)

- "You're in!" + three bouncing dots is charming and on-brand.
- Participants see *themselves* waiting but not the other chips that the
  presenter sees. Consider mirroring the presenter's participant chips here —
  it turns the wait from dead time into social proof. Low effort; the socket
  event already exists.

### Question — open phase

- Clean. Progress bar, title, metadata, choices, submit. Nothing to fix
  structurally.
- **Timer:** red text at ≤5s is good. At the moment it's pure text — a thin
  animated ring or shrinking bar around the timer would be noticed without
  adding visual weight.
- **Selected state:** toggle-able choice buttons flip from outlined to filled
  black. On touch devices the flip is abrupt. A 120–150ms ease transition on
  background/color would feel more deliberate.
- **Submit button** is disabled with no answer selected but gives no hint why.
  Consider a muted helper line ("Select an answer to submit") rather than just
  a grayed button.

### Question — locked / results phase

- The bar-chart distribution is the best-looking screen in the app. Keep it.
- Personal result banner (green/red) — the red "Incorrect" box can feel
  harsh in training contexts. Consider softening to a neutral slate with a
  red accent bar on the left, and lead with the correct answer rather than
  the verdict. Keeps it educational, not punitive.
- **Correctness not yet revealed:** currently the participant sees the
  distribution but is not told their answer is locked and awaiting reveal.
  A small status chip ("Answer locked · awaiting reveal") would reduce the
  "did it go through?" anxiety.

### Final scoreboard

- Top 10 with self-row highlighted in black is good.
- **If the user is outside the top 10**, their rank should still be shown
  below the cut ("You · #14 · 220 pts"). Worth verifying; currently unclear
  from code inspection whether this exists.
- The phrase "Final Scores" could be warmer — "That's a wrap" or "Final
  standings" — very optional, borderline personality-territory.

## 4. Admin flow

### Login — `src/app/admin/login/page.tsx`

- One password field, centered card. Fine.
- No visible brand: "Admin Login" in a vacuum. Adding the same wordmark
  treatment as the landing page (small `Quicz` above "Admin") ties the two
  together and makes it feel less like a generic CMS.
- Generic "Invalid password" error is correct security-wise (don't leak);
  keep as is.

### Protected header

- "Quicz Admin" text link + "Logout" button is serviceable.
- The header is white-on-white with only a border-bottom — easy to miss as a
  header. A touch more weight (slightly bolder wordmark, or a tiny badge next
  to "Admin") would establish the zone.
- No breadcrumb or context: when editing a quiz, the header doesn't tell you
  which quiz. Breadcrumbs (`Quizzes / Safety Training`) would cut cognitive
  load on the editor page in particular.

### Quizzes list

- Empty state is clear. Populated state is a plain list.
- **Missing metadata:** no date created, no last session run, no status
  (draft / has been run). One small muted line per row would make the list
  scannable when there are 20+ quizzes.
- "+ New Quiz" placement is fine; consider visual alignment with a primary
  CTA style consistent with the landing "Join a Quiz" button.

### Quiz editor — `QuizEditor.tsx`

- The densest screen in the app. Works, but has the most rough edges.
- **Hover-to-reveal delete buttons** are a known usability antipattern on
  touch and for users who don't realize they're there. Either: always show
  them at reduced opacity, or move destructive actions behind a small overflow
  menu per question/choice.
- **"Saved ✓" indicator** is nice. Consider pairing with a timestamp
  ("Saved · 2m ago") to reassure during long edits.
- **Question-type toggle** (Single/Multi/Yes/No) — the terms are clear but a
  small icon per type would speed recognition when scrolling a long quiz.
- **Validation errors** render as a red-bordered bulleted list at the top. Fine
  for now; the stronger move is inline errors anchored to the offending field
  with a small jump-to-error link in the summary box.
- **Time limit input:** unclear from the UI whether `0`/empty means "no limit"
  or "instant." Add a placeholder like `No limit` or an explicit toggle.
- No keyboard shortcut affordance for "Save" (Cmd/Ctrl-S) — natural fit and
  cheap to add.

### Presenter view — `PresenterView.tsx`

This is the screen projected in a room, so it's judged from 5 meters away.

- **Lobby QR + code panel:** great — the pop-in chip animation is genuinely
  delightful. Keep.
- **Quiz phase is too small for projection.** Session code, participant count,
  current question, response count — all rendered at desktop-UI scale. Needs
  a "presenter mode" scale: larger type, more whitespace, less chrome. At
  minimum: bump the current question to `text-4xl` or larger, center the
  response counter.
- **Phase badges** (green/yellow/blue/purple) carry a lot of information for
  the presenter; worth documenting on-screen what each color means the first
  time (tooltip or a one-line legend in the footer).
- **Keyboard shortcut footer** is a strong feature. Consider a `?` key to
  pop a larger shortcut help overlay.

### Results page (per-session analytics)

- Clean table + bar charts. Solid.
- **Export CSV** button could be more discoverable — currently a small text
  link near the title. For the user who came here specifically to export,
  that's the primary action and deserves button weight.
- **Per-participant drill-down** is absent. Clicking a participant row could
  show their answer-by-answer history. Out of scope for this pass but worth
  noting.

## 5. Cross-cutting issues

1. **No design tokens.** Tailwind's scale is used directly everywhere. A
   minimal `@theme` block (Tailwind v4) with named tokens — `--color-surface`,
   `--color-surface-muted`, `--color-ink`, `--color-ink-muted`,
   `--color-accent` (reserved; unused in minimalist direction) — would make
   future theming trivial and catch inconsistencies.

2. **No shared Button/Input/Card.** Three or four tiny components under
   `src/components/ui/` (`Button`, `Input`, `Card`) would eliminate the
   class-string duplication noted earlier. Using CVA
   (class-variance-authority) or plain prop switches is equally fine at this
   scale.

3. **Focus rings are missing on buttons.** `focus:outline-none` appears on
   inputs; buttons rely on default browser outline, which is removed by
   Tailwind preflight on some builds. Add `focus-visible:ring-2
   focus-visible:ring-black focus-visible:ring-offset-2` to primary actions.

4. **Color contrast.** `text-gray-500` on white for body copy is borderline
   for WCAG AA (hits ~4.0:1; AA wants 4.5:1). Shifting secondary copy to
   `text-gray-600` across the app is a one-line-per-screen fix.

5. **Empty / loading / error states are text-only.** Fine for a minimalist
   app, but consistency matters: right now some loading states are
   "Loading…", others are nothing, others are spinners. Pick one idiom
   (muted "Loading…" text or a single shared skeleton pattern) and apply it
   uniformly.

6. **Mobile breakpoints are implicit.** The app is mobile-first and mostly
   works, but PresenterView and QuizEditor aren't verified at narrow widths.
   A single responsive pass with device-mode QA would surface the gaps.

7. **Motion.** The only custom motion is the pop-in animation on participant
   chips. Consider one more: a 200ms fade/slide between question phases
   (open → locked → results). Currently the transition is instant and can
   feel jarring on the presenter screen.

8. **Metadata / favicons.** `layout.tsx` has a minimal `metadata` block and
   no favicon, no OG image, no theme color. A wordmark favicon and an OG
   card would make shared links feel finished.

## 6. Prioritized punch list

Grouped by effort-to-impact ratio. Everything is "minimalist + polish" — none
of this introduces an accent color or new visual direction.

### High impact, low effort (do these first)

- Ship a custom font via `next/font` (Geist or Inter + a mono pair).
- Extract shared `Button` / `Input` components; unify class strings.
- Add `focus-visible` rings on all interactive elements.
- Bump `text-gray-500` → `text-gray-600` for secondary copy (AA contrast).
- Add favicon + OG image; set `themeColor` in metadata.

### Medium impact, low-to-medium effort

- Landing page: add the `QUICK · QUIZ` gloss, demote Admin to a corner link,
  consider a landing code-entry shortcut.
- Join: consider six-box code input (stylistic upgrade, not required).
- Admin editor: always-visible delete buttons (not hover-only); `Cmd-S` to
  save.
- Presenter: scale up type on the quiz-phase panel for room projection.
- Quiz list: add created/updated metadata per row.

### Lower priority (nice-to-haves)

- Animated timer ring on question screen.
- Phase-transition motion (200ms fade) on presenter view.
- Participant lobby mirror of presenter chips.
- Soften "Incorrect" banner toward educational framing.
- Export CSV as primary button on results page.
- Shortcut-help overlay (`?`) on presenter view.

### Intentionally not recommended

- Accent color (scope was minimalist + polish).
- Illustrations / hero imagery.
- Dark mode (not asked for; current system is single-theme tuned).
- Rewriting the presenter view (structure is good; it just needs scale).
