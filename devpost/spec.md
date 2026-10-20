---
doc: spec
status: approved
---

# ProcrastiNOT — Technical Spec

## How This Works, In Plain Language

ProcrastiNOT is a website that runs in the browser. React draws the dashboard and remembers what is currently on screen; a small save/load module copies the student's editable day and accepted schedule into this browser's local storage so a refresh does not erase them. The original sample day stays in the app's files as a clean reset point.

When the student adds the surprise lab, a separate scheduling function receives a snapshot of the latest tasks, commitments, study windows, completed sessions, and current time. It returns a proposal and plain-language reasons. The proposal is saved separately from the accepted schedule. It changes the day only after the student approves a still-valid proposal. If the student edits the inputs or waits until a proposed start time has passed, the proposal becomes outdated instead of being applied to the wrong version of the day.

React's built-in reducer is the app's traffic controller: each edit, reset, proposal, or approval is one named action that updates the page consistently. If a saved day has a different local date from today, the app preserves it as a read-only archive and pauses changes until the student confirms starting today's sample. Vitest checks the scheduling rules without opening the website; React Testing Library checks what a student sees and does. There is no backend, account system, AI service, or network dependency in the working app.

This approach keeps the central idea—the real, explainable schedule recovery—in a testable function, while keeping the rest small enough to build in Copilot-assisted, verifiable stages.

## The Core Journey Through the System

Implements `prd.md > The Core Journey`.

1. **Open the dashboard:** `sampleDay.ts` provides the original realistic day. The persistence module loads a validated saved day if present; otherwise it returns the sample. `App` shows the timeline, summary, task editor, recovery preview, Ghost, and task-context mascots only when relevant.
2. **Edit tasks or commitments:** A form validates input before dispatching a save action. The reducer updates the current day and its input revision. The persistence module saves it. Any proposal based on an earlier revision becomes outdated and remains visible for reference.
3. **Add the surprise lab:** One action adds the fixed 4–6 PM lab to the current commitments and starts proposal generation from the changed input snapshot. The accepted study schedule remains unchanged.
4. **Calculate and compare:** The pure scheduler preserves blockers and completed sessions, rebuilds all incomplete task placements in the deterministic order below, and returns a proposal with an immutable baseline snapshot and explanations. The comparison UI shows the lab, moved/unchanged/completed items, tasks not scheduled today, and risk labels.
5. **Approve or keep the original:** Approval checks both the input revision and current time again before atomically replacing the accepted incomplete placements. Rejection changes only proposal status: accepted study placements stay as they were, and the lab remains fixed.
6. **Reset and replay on the same day:** Reset copies the immutable original sample into the active current-day state, clears all current-day proposal history and the simulated lab, saves that initial state, and returns the dashboard to its starting view. It is not an archive operation.
7. **Start a new day after rollover:** If a saved plan belongs to a different local date, preserve it and its proposal history, pause editing/scheduling/approval, and show the rollover notice. Only after the student confirms **Start Today's Sample Day** does the app archive the old day and create a clean sample for today's date.

```text
Student action
    ↓
React component → validated action → planner reducer
                                  ↙               ↘
                    pure scheduling function     persistence module
                             ↓                      ↓
                    proposal snapshot       browser local storage
                             ↓
                  compare / explain / review
                       ↙              ↘
                  approve           reject
             accepted schedule     lab stays fixed
```

## Stack

- **React** — builds the dashboard from small, reusable interface pieces. Use React hooks and a reducer included with React; no separate state-management package.
  - Documentation: [React documentation](https://react.dev/learn)
- **TypeScript** — gives tasks, time windows, sessions, and proposal statuses explicit shapes so incompatible data is easier to catch.
  - Documentation: [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- **Vite** — runs the local development website and produces the static files for an optional frontend deployment.
  - Documentation: [Vite Guide](https://vite.dev/guide/)
- **Vitest** — runs fast tests for the scheduling, validation, deadline-label, and persistence functions; it fits the Vite project.
  - Documentation: [Vitest Guide](https://vitest.dev/guide/)
- **React Testing Library** — checks important user-visible dashboard flows without coupling tests to internal component details.
  - Documentation: [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- **CSS** — use ordinary project stylesheets and CSS variables for the warm palette and responsive layout. Do not add a styling framework for this small app.

Use compatible current stable releases when the project is scaffolded. Confirm the installed Node.js version against the then-current Vite requirements during the first build step; no version lookup has been done as part of this specification.

## Where It Runs and How Someone Tries It

- **Runtime:** A browser-based website served locally by Vite during development. The production build is static frontend files. State is local to the browser and origin; there is no shared account or server database.
- **Development environment:** Node.js and npm, with a current Node.js release supported by the installed Vite version. No API keys or secrets are needed.
- **Start locally:** From the project root, run `npm install`, then `npm run dev`. Vite is configured to use port `5173` and report an error rather than silently choosing a different port. Open `http://localhost:5173/`.
- **Verify:** Run `npm run test -- --run` for the test suite and `npm run build` for the production build. `npm run preview` can locally serve the built files for a final check.
- **Persistence:** Local storage is specific to the current browser and site origin. A judge opening the public website in their own browser starts with the sample day; their edits do not appear in another person's browser. Local development and a deployed origin also have separate local storage.
- **Required ship deliverables:** A public source repository with an open-source licence and setup instructions, plus a public demo video under three minutes. The local app is enough to record the video.
- **Optional deployment:** Finish and verify locally first. At ship time, investigate a simple free static host (Vercel is a candidate; verify its current free-plan terms and setup then). A live link is a bonus and must not delay or replace the repository or video.

## Look and Feel

Implements `prd.md > Screens and Layout` and `prd.md > Look and Feel`; carries forward `scope.md > Inspiration & Identity`.

- A responsive, minimal dashboard with warm white, blush, lavender, butter yellow, and sage green, implemented as CSS custom properties.
- Keep the day timeline readable and make fixed commitments visually distinct from movable study sessions. Pair color with labels or shapes so meaning is not color-only.
- Use clear, friendly typography and generous spacing. Keep the recovery action noticeable but not alarming.
- Keep copy calm, concise, supportive, and free from guilt language or excessive notifications.
- Keep Ghost as the welcome-area companion. Show Penguin only after a task is newly saved as completed, Hedgehog only while planning an incomplete task, and Jumpclip beside the existing task-add action. These remain static illustrations and must not imply unsupported functionality.
- **Cloudy — pending:** the original approved artwork is unavailable. Do not add a broken image or create replacement art; integrate Cloudy only when the original is supplied. Mood-based Study Rescue is not implemented.
- On narrow screens, stack dashboard regions and allow the day timeline to scroll horizontally if needed; do not hide task details or proposal actions.

## Components

### `App` and Planner State

Own the `useReducer` planner state and pass data and named actions to the dashboard. Initialize from the persistence module, render a visible recovery notice if saved data could not be loaded, and coordinate persistence after state changes. Keep proposal state separate from accepted schedule state.

Implements `prd.md > The Core Journey`, `Sample-Day Dashboard and Editing`, `Proposal Review, Approval, and Stale Data`, and `Reset and Repeatability`.

### Day-Rollover Notice and Archive Reference

On startup and when the page resumes after being hidden, compare the saved active plan date with the current local date. If they differ, show the saved day read-only, explain that it is preserved, and pause task edits, scheduling, and proposal approval. A clearly labelled **Start Today's Sample Day** action opens a confirmation explaining that the old day and proposals will be archived and today's sample will become active. The archive is reference-only and cannot be scheduled or edited.

This is a rollover-specific safeguard, separate from the ordinary same-day reset. It preserves a one-day planning model and does not add weekly planning.

Implements `prd.md > Reset and Repeatability`; rollover is an additional explicitly approved technical behavior, flagged below for PRD alignment.

### Dashboard and Daily Summary

Show the sample-day date, tagline, reset action, available-study-time summary, deadline categories, and Ghost. Calculate deadline labels using the student's local calendar date; do not use those display labels as a substitute for actual deadlines in the scheduler. Other mascots appear only in their task-related contexts.

Implements `prd.md > Screens and Layout` and `Task Validation`.

### Schedule Timeline

Render fixed commitments, protected sleep, unavailable periods, accepted study sessions, and proposal comparison states in chronological order. Show task name, duration, deadline, priority, status, and scheduled time where applicable. Expose conflicts in text, including when the original accepted schedule still overlaps the surprise lab after rejection.

Implements `prd.md > Screens and Layout`, `Sample-Day Dashboard and Editing`, and `Surprise Lab and Recovery Proposal`.

### Task and Commitment Forms

Provide compact, accessible add/edit forms. Task form validation uses the exact PRD messages and preserves entered values on errors. Commitment and window forms validate non-empty labels and same-day start/end times with start before end. A form draft is not a saved scheduling input until the student saves it; cancelling a draft discards only that draft.

Implements `prd.md > Sample-Day Dashboard and Editing` and `Task Validation`.

### Recovery Comparison

Display an immutable proposal baseline beside its suggested schedule. Mark each session moved, unchanged, completed, or not scheduled; show per-task explanations and distinguish **At risk** from **Not scheduled today**. Show whether the proposal is current, outdated, approved, or rejected and expose approve/keep-original actions only when appropriate.

Implements `prd.md > Surprise Lab and Recovery Proposal` and `Proposal Review, Approval, and Stale Data`.

### Pure Scheduling Engine

Accept explicit input data and an injected current time; return placements, task outcomes, and explanation codes/text. It has no React, DOM, local storage, network, randomness, or direct system-clock access, so Vitest can test it independently.

Implements `prd.md > Surprise Lab and Recovery Proposal` and `States and Boundaries`.

### Planner Reducer

Apply named actions for task/commitment/window edits, lab simulation, proposal generation, approval, rejection, outdated status, and reset. Increase the scheduling-input revision on each saved scheduling-input change. Preserve prior proposal snapshots while marking them outdated.

Implements `prd.md > Sample-Day Dashboard and Editing`, `Proposal Review, Approval, and Stale Data`, and `Reset and Repeatability`.

### Local Persistence Module

Read, validate, and write the versioned local-storage document. It does not expose raw local-storage parsing to components. On malformed or unsupported saved data, return a clean sample state and a recoverable notice; on storage access/write failure, keep the app usable in memory and show that changes may not survive refresh.

Implements `prd.md > Sample-Day Dashboard and Editing`, `Proposal Review, Approval, and Stale Data`, and `Reset and Repeatability`.

## Data Model

All data is for one displayed local calendar day. Times are minutes after local midnight, in half-open intervals `[start, end)`; the end boundary is not occupied. Deadline values are local date strings (`YYYY-MM-DD`) and priority/status values are enumerated strings. Do not convert date-only deadlines through UTC, which can change their displayed local day.

### `Task`

- `id`: stable string identifier.
- `name`: trimmed, non-empty string.
- `durationMinutes`: numeric value greater than `0` and at most `480`.
- `deadlineDate`: local `YYYY-MM-DD`; scheduler uses this actual value, not the dashboard label.
- `priority`: `high | medium | low`.
- `status`: `notStarted | inProgress | completed`.
- `preferredWindow`: optional same-day `{ startMinute, endMinute }`.
- `originalOrder`: unique, stable integer assigned when the task is created and used as the final ordering tie-breaker. The MVP has no manual task-reordering control; duplicate saved order values invalidate the stored document.

Every task not marked `completed`, including `inProgress`, is planned as a whole task using its full entered duration. The MVP does not guess elapsed work or track partial minutes.

### `FixedCommitment`

- `id`, `title`, `startMinute`, `endMinute`.
- `kind`: for example `class | lab | other`.
- `isSimulated`: true only for the repeatable surprise lab.

Fixed commitments never move. The surprise lab is one fixed commitment from 16:00 to 18:00 local time. Adding it is idempotent: it cannot create duplicate surprise labs.

### `DayPlan`

- `date`: displayed local planning date.
- `tasks`: editable task records.
- `commitments`: fixed commitments, including the surprise lab when active.
- `availabilityWindows`: explicit intervals in which study may occur; empty calendar gaps are not implicitly available.
- `protectedSleep`: protected intervals, separate for clarity.
- `unavailablePeriods`: other explicit non-study intervals such as breaks.
- `acceptedSessions`: the currently accepted study-session schedule.
- `inputRevision`: monotonically increasing integer for saved data used by scheduling.

The immutable initial day and tasks are exported by `sampleDay.ts`; the user's current day is a separate copy. Original sample data is not overwritten by edits.

### Initial Sample-Day Fixture

Reset creates a fresh day for the student's current local calendar date with this explicit baseline:

- **Protected sleep:** 22:30–24:00 and 00:00–07:00 (stored as two same-day intervals).
- **Available-study windows:** 07:30–12:00, 13:00–18:00, and 18:00–22:30. No other time is assumed available.
- **Fixed commitments:** lecture 09:00–10:30 and lab/class 14:00–15:00.
- **Other unavailable period:** break 12:00–13:00.
- **Completed example session:** 08:00–08:30, retained at its original time.
- **Incomplete example placements:** a 90-minute task at 10:30–12:00 and another 90-minute task at 16:30–18:00. The latter demonstrates the fixed 4–6 PM surprise-lab conflict.
- **Tasks and initial sessions:** completed “Review class notes” (30 minutes, session 08:00–08:30); in-progress “Revise Computer Networks” (90 minutes, due today, High, session 16:30–18:00); “Finish DBMS lab report” (90 minutes, due tomorrow, Medium, session 10:30–12:00); “Prepare for the Data Structures exam” (300 minutes, due today, Low, no initial session); and “Practice calculus problems” (60 minutes, due in five days, Low, initial session 15:00–16:00).
- **Capacity example:** The 300-minute due-today task has no single eligible window long enough after the fixed class and lab blockers, demonstrating honest At risk handling without splitting. The future-deadline task can demonstrate Not scheduled today in the no-remaining-capacity test fixture.

Example task titles and priorities should be student-friendly; the date-relative deadlines are derived from the local planning date (today, tomorrow, and more than three days away). If tests or the recording need a stable clock, use the fixed injected time in their fixtures, not a different production clock or fake scheduler.

### `StudySession`

- `id`, `taskId`, `startMinute`, `endMinute`.
- `status`: `planned | completed`.

Completed sessions are retained at their original times and included as occupied time. Completed tasks are never scheduled again. Incomplete accepted placements are rebuilt when a proposal is generated.

### `RecoveryProposal`

- `id`, `status`: `current | outdated | approved | rejected`.
- `createdAt`, `inputRevision`, `planningDate`, and `calculatedAt` (the injected/current local time used to calculate remaining windows).
- `baseline`: immutable snapshot of all scheduler inputs—tasks, commitments, availability windows, protected/unavailable periods, planning date, and accepted sessions—used for the comparison. This keeps an outdated proposal readable even after live data changes.
- `proposedSessions`: calculated placements, including preserved completed sessions.
- `outcomes`: per-task snapshot and state (`scheduled | atRisk | notScheduledToday`), placement, comparison classification, and plain-language reason.
- `outdatedReason`: optional human-readable reason, including input edits or a proposed start time that has passed.

Proposal snapshots and accepted sessions are distinct values. A generated, current proposal is awaiting approval; it is never the accepted schedule merely because it was calculated.

### `ArchivedDay`

- `id`, `date`, `archivedAt`.
- `dayPlan`: a complete snapshot of that prior day's tasks, commitments, explicit study windows, protected/unavailable periods, accepted schedule, and input revision.
- `proposals`: immutable snapshots of the prior day's current, outdated, approved, or rejected proposals.

An archive is read-only and never passed to the scheduling engine. It exists only for the learner's requested date-rollover reference; it is not a weekly planner.

### Persistence Shape

Store one versioned JSON document under a single key such as `procrastinot:v1`, with top-level `activeDay` (including its `acceptedSessions`), active `proposals`, and read-only `archives`. Keeping the accepted schedule inside its day, and proposals/archives separate from the active day, prevents proposal generation from overwriting accepted sessions and rollover from overwriting a prior day. The original sample baseline remains in code, not local storage. A single document write avoids partially saving active state and archive state under separate keys.

On startup, parse and validate the schema version and required fields. Missing data means first use and returns the sample. Malformed, unsupported, or structurally invalid data restores the safe sample and displays a notice. If local storage is blocked or a write fails, continue in memory, show a notice, and do not claim the edit was persisted. Store no credentials, private profile, or unnecessary personal information.

For a date rollover, prepare the archive and today's new sample in one validated document update. If the update cannot be persisted, do not switch the active day or claim the old day was archived; retain it and show an error so the user can retry.

## Deterministic Scheduling Algorithm

Implements `prd.md > Surprise Lab and Recovery Proposal`; exact output and ordering follow the approved learner decisions.

### Inputs and Clock

The pure function receives the current `DayPlan`, its accepted sessions, and an explicit `now` instant. Production passes the current local time; every unit test passes a fixed instant. The function does not read `Date.now()` itself. Scheduling considers only the remainder of this local planning day.

### Step 1 — Preserve and Identify Work

1. Copy all fixed commitments, protected sleep, unavailable periods, and completed sessions unchanged.
2. Keep completed task sessions at their original positions; never include completed tasks in the incomplete-task queue.
3. Discard old placements for every non-completed task from the candidate placement set. Their full `durationMinutes` is still required, including for `inProgress`.
4. Retain the pre-calculation accepted sessions as the immutable comparison baseline. Nothing changes in the accepted schedule during calculation.

### Step 2 — Build Remaining Eligible Study Slots

1. Normalize and merge overlapping or adjacent explicit availability windows, then clip them to the displayed day and remaining time. A fully elapsed window (`endMinute <= nowMinute`) contributes no slot. A window in progress begins at `nowMinute`; a future window keeps its defined start.
2. Collect occupied intervals: all fixed commitments, completed sessions, protected sleep, and other unavailable periods.
3. Subtract occupied intervals from the explicit, remaining availability windows. Merge overlapping blockers and avoid double-subtracting them. Empty gaps outside explicit availability remain unavailable.
4. Sort the resulting free intervals by start time. Boundaries are half-open, so a task may end exactly when a blocker or window boundary begins/ends but may not overlap it.

### Step 3 — Order Incomplete Tasks

Sort all non-completed tasks by:

1. `deadlineDate` ascending (earliest actual local date first, including overdue tasks).
2. Priority descending: High, Medium, Low.
3. `originalOrder` ascending.

Display categories (Overdue, Due today, Approaching, Upcoming) never change this ordering.

### Step 4 — Place Each Whole Task

For each task in that order:

1. Find free intervals with length at least the full task duration.
2. If the task has a valid preferred window, first select the earliest chronological interval within the intersection of that preference and an eligible free interval that fits the full task. If none fits wholly in the preferred window, drop the preference constraint and select the earliest full-fitting eligible interval from all remaining free time. This fallback may partially overlap the preferred window; it is not treated as honoring the preference, and it prevents a soft preference from making otherwise usable time appear unavailable.
3. If there is no preferred window, select the earliest full-fitting eligible interval.
4. Place the complete task at the earliest possible start of the selected interval. Subtract that placement from free time before considering the next task. Never move an earlier placement during the same calculation.
5. If no interval fits, leave the task unscheduled. Do not split, shorten, push into the past, overbook, or violate a blocker.

A preferred time is soft; it never bypasses global task order, the current-time boundary, or an occupied interval. If no whole session fits within the preferred window, the earliest whole-task fit anywhere in remaining eligible time is used, even if it partly overlaps that window. The algorithm does not backtrack to optimise total task count: the agreed deadline/priority-first order determines which task receives scarce capacity.

### Step 5 — Label Outcomes and Explain Them

- Compare each calculated incomplete placement with its baseline placement. Same task and same interval is **Unchanged**; a different interval is **Moved**; no baseline placement followed by a placement is **Scheduled**; no valid placement is **Not scheduled**.
- An unscheduled task whose deadline is the displayed local date or earlier is **At risk**, with a plain-language reason such as “No remaining available study window is long enough for this 90-minute task.”
- An unscheduled task with a future deadline is **Not scheduled today**, not a claim that its future deadline cannot be met.
- An overdue task remains labelled overdue even if the scheduler places it later today. A task scheduled after its due date is not represented as having met that deadline.
- Keep completed and fixed items visually distinct from newly calculated placements. Explain moved placements in concise, truthful language; include the preference fallback when a preferred window had no fitting slot.
- Identical task data, original order, commitments, availability, protected/unavailable intervals, baseline sessions, planning date, and injected `now` produce identical placements, labels, and explanations.

### Scheduler Acceptance and Vitest Cases

- [ ] Deadline-first sorting beats priority: an earlier-deadline Low task is placed before a later-deadline High task when capacity is constrained.
- [ ] Equal deadlines sort High, then Medium, then Low.
- [ ] Equal deadline and priority preserve unique `originalOrder`; repeated runs with identical injected inputs give identical output.
- [ ] Overlapping and adjacent blockers are subtracted safely; placements do not overlap a fixed commitment or protected sleep.
- [ ] A task can use only explicit windows; empty gaps outside them remain unusable.
- [ ] A window ending at or before injected `now` is unusable; an in-progress window is clipped to `now`; a future window remains usable.
- [ ] A completed session in the past remains at the same time and blocks overlap; no completed task is scheduled again.
- [ ] An `inProgress` task uses its full entered estimated duration and is not shortened by guessed progress.
- [ ] A task exactly as long as an eligible slot fits; a longer task remains unscheduled. No task is split or shortened, and there is no overbooking.
- [ ] A whole-task slot inside a valid preferred window is chosen when one fits; otherwise preference is ignored and the earliest full-fitting eligible slot is used (even if it partly overlaps the preferred window), without moving earlier placements.
- [ ] A due-today/overdue task that cannot fit is At risk; a future-deadline task that cannot fit today is Not scheduled today and is not described as impossible before its deadline.
- [ ] With no remaining eligible time, all incomplete tasks remain unscheduled with correct risk labels; fixed and completed items remain visible.

## Proposal Lifecycle and Clock-Safe Approval

Implements `prd.md > Proposal Review, Approval, and Stale Data` and `Reset and Repeatability`.

1. Adding the surprise lab adds the fixed commitment once, increments `inputRevision`, preserves accepted sessions, calculates a proposal against a copy of those accepted sessions, then saves the new state.
2. A current proposal records the exact input revision and baseline. It is reviewable but does not change accepted sessions.
3. Saving a task, commitment, availability, protected-sleep, or unavailable-time change increments `inputRevision`. A current proposal from an earlier revision becomes Outdated; its baseline, placements, and reasons are not rewritten. A cancelled unsaved form changes nothing.
4. **Approve revised plan:** verify the proposal is current and its input revision still matches. Read the current local time again. If any proposed incomplete session would start before that time, mark the proposal Outdated, leave the accepted schedule untouched, and show: “This plan contains a study session whose start time has already passed. Generate an updated plan to continue.” Apply nothing partially. Otherwise replace accepted incomplete placements atomically, retain completed sessions/fixed items, and mark the proposal Approved.
5. **Keep original plan:** mark the current proposal Rejected and leave accepted study sessions unchanged. The lab remains in commitments at 4–6 PM and any conflict stays visible.
6. A new proposal can be generated from current data after an outdated/rejected proposal. Keep old snapshots for reference. Repeated saved edits invalidate the current proposal again.
7. **Ordinary Reset Sample Day (same date only):** replace the active day with a fresh copy of the original sample for the current date, remove the simulated lab, restore original accepted sessions, and clear all current-day proposal history/notices. Do not archive. Disable this action while a prior-day plan awaits rollover.
8. **Date rollover:** on load and when the page resumes, compare the saved active plan's local date with today's local date. If they differ, preserve the active plan and proposal history unchanged, mark it read-only, and disable edits, scheduling, approval, and ordinary reset. Show: “This plan belongs to a different day. Your saved work is preserved.” Offer **Start Today's Sample Day**.
9. Selecting **Start Today's Sample Day** opens a confirmation that explains the previous day's complete plan and proposal history will be archived for reference, and a clean sample will replace the active day. Cancel leaves the prior plan and all storage unchanged. Confirm atomically appends an immutable read-only archive and creates today's clean sample with no surprise lab or old active proposals. Use today's local date and a fresh current clock for later calculations.

### Proposal and Persistence Acceptance Tests

- [ ] Adding the lab adds one fixed 4–6 PM commitment and generates a current proposal without changing accepted sessions.
- [ ] Approving a still-current proposal whose incomplete starts are still in the future applies it; fixed commitments and completed sessions are unchanged.
- [ ] If injected time advances past a proposed incomplete session's start, approval marks the proposal Outdated, shows the specified message, and leaves every accepted session unchanged.
- [ ] Rejecting a proposal leaves accepted sessions untouched, keeps the lab fixed at 4–6 PM, and keeps any conflict visible.
- [ ] Editing a task or commitment while reviewing a proposal marks that proposal Outdated, preserves its snapshot, and prevents approval; a new proposal uses the latest inputs.
- [ ] Editing availability, protected sleep, or unavailable periods also invalidates a proposal because those values affect scheduling.
- [ ] Ordinary same-day reset restores the original sample for today, removes the lab and all current-day proposal history, shows the initial recovery preview, and allows the same lab scenario to be replayed without creating an archive.
- [ ] Task edits, fixed commitments, and the accepted schedule survive reload in the same browser/origin; proposals remain distinct from accepted schedule data.
- [ ] Missing storage data returns the sample. Malformed or unsupported saved data restores safe defaults without crashing and shows a notice.
- [ ] Storage read/write denial leaves the app usable in memory and shows that changes may not survive a refresh.
- [ ] A same-day reload does not create an archive or trigger the rollover confirmation.
- [ ] On a different local date, the old plan and all proposal history remain byte-for-byte/semantically unchanged and read-only; task edits, scheduling, approval, and ordinary reset are blocked.
- [ ] Cancelling rollover confirmation changes neither active plan nor archive history.
- [ ] Confirming rollover stores the complete old day and proposal history read-only, then creates a clean current-date sample with no lab or active proposals.
- [ ] Reopening after successful rollover does not duplicate the archive; injected clocks make date-change and current-day reset tests repeatable.
- [ ] If rollover archive persistence fails, retain the old active day, do not switch dates, and show an error rather than claiming the archive was saved.

### Validation and Deadline-Label Tests

- [ ] Whitespace-only names fail with the exact required message; valid names are trimmed.
- [ ] Zero, negative, non-numeric, and above-480-minute durations fail with the exact required message; valid positive values through 480 are accepted.
- [ ] Missing/invalid deadlines fail with the exact required message; past dates remain valid task data.
- [ ] Invalid preferred-time order fails; a valid window overlapping a commitment remains valid and is handled by scheduler fallback.
- [ ] Medium is selected by default for a new task; only the three supported priority/status values are accepted.
- [ ] A fixed-date test clock verifies Overdue, Due today, 1–3 day Approaching, and more-than-3-day Upcoming labels in the local calendar; completed tasks are excluded from overdue/due-today/approaching categories.
- [ ] Input errors appear beside fields, do not rely on color alone, and preserve other entered form values.

## Input Validation and Error Handling

Implements `prd.md > Task Validation` and `States and Boundaries`.

- Task name is trimmed and required; blank/whitespace-only input shows **“Please enter a task name.”**
- Duration accepts numeric values greater than `0` and up to `480` minutes inclusive. Zero, negative, non-numeric, and greater-than-480 values show **“Duration must be between 1 and 480 minutes.”** Never clamp or substitute a value.
- Deadline is a valid local date; missing or invalid input shows **“Please enter a valid deadline.”** Past dates are valid task data and are categorized, not rejected.
- Priority is exactly High, Medium, or Low; new tasks visibly default to Medium. Status is Not started, In progress, or Completed.
- Preferred time is optional; if present, start must be before end. A window conflicting with a fixed commitment remains valid input; the scheduler explains preference fallback.
- Show field errors inline and visually, not by color alone. Preserve other entered values; disable Save when required fields are invalid and validate again on Save. Never pass invalid tasks to the scheduler.
- Deadline categories use the local calendar date: incomplete tasks are Overdue (date before today), Due today, Approaching (1–3 calendar days after today), or Upcoming (more than 3 days away). Completed tasks are excluded from overdue/due-today/approaching highlights. These categories are display labels only.
- Commitment/window intervals must have a valid label and same-day start before end. On error, identify the invalid field and preserve the rest of the form.
- Explain scheduler results without claiming more than the data proves. A later-deadline task not placed today is “Not scheduled today”; only due-today/overdue unscheduled tasks are At risk.

## File Structure

The initial project root contains Devpost learning artifacts but no application scaffold. This is the planned Vite app layout; generated `node_modules` and build output are omitted.

```text
ProcrastiNOT/
├── devpost/
│   ├── learner-profile.md
│   ├── scope.md
│   ├── scope.html
│   ├── prd.md
│   ├── prd.html
│   ├── spec.md
│   └── spec.html
├── src/
│   ├── main.tsx                 # Mount React into the browser page
│   ├── App.tsx                  # Dashboard, Ghost, contextual Penguin/Jumpclip, planner state
│   ├── types/
│   │   └── planner.ts           # Task, day, session, and proposal types
│   ├── data/
│   │   └── sampleDay.ts         # Immutable initial sample/reset baseline
│   ├── logic/
│   │   ├── scheduler.ts         # Pure deterministic whole-task planner
│   │   ├── validation.ts        # Pure task and interval validation
│   │   ├── deadlineLabels.ts    # Local-calendar display categories
│   │   ├── scheduler.test.ts    # Vitest engine cases and injected clocks
│   │   ├── validation.test.ts   # Field validation and error messages
│   │   └── deadlineLabels.test.ts
│   ├── state/
│   │   └── plannerReducer.ts    # Named planner actions and proposal lifecycle
│   ├── components/
│   │   ├── Dashboard.tsx        # Page layout and daily summary
│   │   ├── ScheduleTimeline.tsx # Day schedule and comparison rendering
│   │   ├── TaskForm.tsx         # Add/edit task form and contextual Hedgehog tip
│   │   ├── CommitmentForm.tsx   # Add/edit fixed commitment/window
│   │   ├── RecoveryPanel.tsx    # Proposal status, reasons, approve/reject
│   │   └── RecoveryFlow.test.tsx # React Testing Library user-visible flow
│   ├── styles/
│   │   └── app.css              # Responsive layout, palette, and component styles
│   ├── storage/
│   │   ├── persistence.ts       # Versioned localStorage, archives, read/write/fallback
│   │   └── persistence.test.ts  # Load/save, malformed data, reset, and rollover archive
├── index.html                   # Vite browser entry
├── package.json                 # Scripts and runtime/development dependencies
├── package-lock.json            # Reproducible npm dependency resolution
├── tsconfig.json                # TypeScript configuration
├── vite.config.ts               # Vite and Vitest configuration
├── README.md                    # Setup, local run, tests, and demo instructions
└── LICENSE                      # Chosen open-source licence for public repository
```

No database, server route, API client, or deployment configuration is needed for local development.

## External Services and Dependencies

- **Runtime external services:** None. No API calls, keys, accounts, analytics, or AI scheduling service.
- **Browser API:** `localStorage`, documented by [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage). It is per browser and origin; handle access errors and invalid stored JSON.
- **Build/test packages:** React, TypeScript, Vite, Vitest, and React Testing Library; their official documentation links are listed under `Stack`. Test packages are development-only.
- **Optional hosting:** A free static frontend provider can be evaluated during ship. Vercel's [Vite deployment guide](https://vercel.com/docs/frameworks/frontend/vite) is a candidate, not a selected or required dependency. Verify current free-plan terms and deployment behavior before use.

## Important Failure Modes

- **Saved local data is invalid or from a newer schema** → restore the known sample day, show a clear recovery notice, and keep the app usable.
- **Browser blocks local storage or a write fails** → continue in memory and tell the student that changes may not survive refresh; do not report persistence success.
- **A proposal is stale because data changed or time elapsed** → preserve its snapshot, prevent application, explain why, and ask for a fresh proposal. Never partially apply it.
- **A task cannot fit any remaining eligible window** → leave it unscheduled and accurately label At risk or Not scheduled today with a plain-language reason; never squeeze it into a blocker.

## What Was Simplified and Why

- **One local browser profile** instead of accounts, server, or database — persistence is enough for the single-student demo and keeps setup free of credentials and infrastructure.
- **Browser local storage** instead of a shared data service — it survives refresh on the same origin; each judge receives a clean sample in their own browser.
- **Pure deterministic whole-task scheduler** instead of AI/API scheduling — it preserves the project's kernel, is explainable, and can be tested offline.
- **Global rebuild of incomplete tasks** instead of a minimal-movement optimiser — stable deadline/priority/order rules are easier to explain and verify; more sessions may move, so the comparison makes each change explicit.
- **Contextual static mascots** instead of interactive companions — their appearances reflect existing task status or actions and do not add planner behavior.
- **Local-first delivery** instead of deployment during the core build — ensures the proof and video remain achievable; a free public link is attempted only after the local app, tests, and public repository are ready.

## Implementation and Testing Plan

Build and verify in small Copilot-assisted stages; after each stage, inspect the generated code, run the app/tests, and understand the changes before continuing.

1. **Scaffold and verify the empty app:** create the React/TypeScript Vite project, configure scripts/test runner, confirm local startup and production build.
2. **Types, sample data, and dashboard shell:** add the immutable sample baseline, explicit study windows, timeline, summary, responsive warm styling, and Ghost welcome artwork; inspect in the browser.
3. **Validation and persistence:** implement forms, pure validation, versioned storage and reset; test invalid/missing data and reload behavior.
4. **Scheduling engine:** implement interval normalization/subtraction, clock clipping, stable sorting, preferred-window placement, outcomes and explanations; complete the focused Vitest suite before UI wiring.
5. **Proposal lifecycle, comparison, and day rollover:** add lab idempotently, persist separate proposal snapshots, stale-state invalidation, clock-safe approval, rejection, same-day reset, and confirmed date rollover with an archive; test each reducer transition.
6. **End-to-end polish:** connect forms, timeline and recovery panel; run React Testing Library flows; check accessibility messages and responsive layout; fix regressions.
7. **Local ship check:** run tests and production build, rehearse the sub-three-minute video locally, then prepare the public repository, licence, and setup instructions. Evaluate optional hosting only after these pass.

Priority if time is tight: preserve the correct scheduler, immutable proposal/baseline behavior, explicit approval/rejection, reset, and the observable demo. Defer visual polish beyond the agreed palette and contextual mascot plan, not core correctness or risk reporting.

## Contextual Mascot Implementation Plan (Approved Extension)

- Keep Ghost in the welcome area as the main study companion.
- Show Penguin only as feedback when an incomplete task is saved as completed.
- Show Hedgehog in the add/edit form for incomplete tasks. Its tip must make clear that the planner does not split tasks into smaller steps.
- Place Jumpclip beside the existing Add task action; do not imply reminder functionality.
- **Cloudy — pending original artwork:** no approved Cloudy image has been found. Keep its break, reassurance, and mood-based Study Rescue role documented as pending; do not create a placeholder image, broken image path, mood flow, or replacement artwork.
- These appearances are static, selective, and driven by existing task state or actions. Do not alter scheduling, persistence, or proposal behavior to support them.

## Decisions and Open Issues

### Agreed Choices

- React + TypeScript + Vite, with React's built-in reducer/hooks and no additional state-management library.
- Browser local storage for editable tasks, commitments, accepted schedule, separately modelled proposal snapshots, and read-only prior-day archives; sample data remains the immutable reset source.
- Browser-only single-user architecture with no backend, accounts, paid API, or external AI dependency.
- Vibe coding with GitHub Copilot in small stages, inspecting generated code and verifying each stage.
- Vitest for the pure scheduler and other logic; React Testing Library for a small number of user-visible flows.
- Local app and demo video are guaranteed; deployment is optional and considered after local verification. Public repository includes setup instructions and an open-source licence; demo video is under three minutes.
- Use explicit available-study windows only. Subtract commitments, completed sessions, protected sleep, and other unavailable periods; do not infer availability from empty gaps.
- Rebuild every incomplete task globally in actual-deadline, priority, and original-order sequence. Place by the agreed earliest-fit/preferred-window rule, never backtrack, split, shorten, overbook, or schedule into elapsed time.
- Completed sessions stay fixed. In-progress tasks use their full entered estimated duration because the MVP has no partial-time tracking.
- Recheck time and data revision on approval; stale proposals cannot be partly or silently applied.
- A same-day reset restores the clean baseline without archiving. When a saved active date differs from today's local date, pause edits/scheduling/approval until confirmation archives the complete old day read-only and activates a clean sample for today. The archive is for reference only, never scheduling.
- Contextual static mascots only, per the approved extension above; interactive companion behavior remains outside the MVP.

### Useful Technical Concept Clarified

The learner asked for reliable state management and approved React's built-in state plus browser local storage. In this design, React state is the live working copy used to update the screen; local storage is the saved copy for the same browser after refresh. A proposal carries an input revision (a simple version number) so the app can tell whether it was calculated from the latest saved day.

### PRD Alignment Note

The approved `prd.md > Reset and Repeatability` describes the ordinary reset to the initial demo state. During this `4-spec` interview, the learner additionally approved a separate confirmed date-rollover action that archives the prior day read-only before starting today's clean sample. The PRD remains unchanged as requested; implement ordinary reset as written there and treat rollover as this explicitly agreed safeguard, not as a replacement or reinterpretation of reset.

### Open Issues

- No product or architecture decision currently blocks review. Confirm the actual Node.js/Vite compatible version and current optional host free-plan terms during the build/ship stages; neither changes the approved product behavior.
