---
doc: checklist
status: approved
---

# Build Checklist

Build mode: learn

## Slices

- [x] **1. You can see the sample day and a real recovery proposal**
  Becomes usable: Acceptance criteria: the app opens to the populated sample day; **Add surprise lab** adds one fixed 4–6 PM commitment; the proposal is calculated by a separate pure deterministic scheduler module and remains unapplied; the comparison distinguishes moved, unchanged, and completed work and truthfully labels unscheduled tasks.
  Why now: Bootstrapping belongs inside the first usable slice, and the deterministic scheduler is ProcrastiNOT's unique kernel. Delivering it with a visible dashboard proves the product early instead of postponing its central behavior behind infrastructure.
  PRD ref: `prd.md > The Core Journey` (steps 1, 3, and 4), `Surprise Lab and Recovery Proposal`
  Spec ref: `spec.md > Where It Runs and How Someone Tries It`, `Components`, `Data Model`, `Deterministic Scheduling Algorithm`, `Look and Feel`, `File Structure`
  Build: Scaffold React/TypeScript/Vite and the agreed test setup; add planner types and immutable sample data; first implement the scheduler in its own pure deterministic module and its automated tests, covering global whole-task rebuilding, deadline/priority/original-order ordering, preferred-time fallback, availability blockers, deadline-risk outcomes, and explanations; then connect it end-to-end to a usable, cleanly styled sample-day timeline and unapplied proposal comparison. Prioritize the working recovery flow and scheduler tests over visual polish; the initial UI must still meet the slice's acceptance criteria.
  Verify (mechanical): Acceptance checks: automated scheduler tests pass for competing deadlines and priorities, original-order ties, completed-session preservation, fixed/unavailable blockers and explicit windows, preferred-window fit and fallback, whole-task-only fit, due/overdue risk vs future “Not scheduled today,” every task represented exactly once with unscheduled reasons, remaining study time clipped to `now` and subtracting blockers without double-counting overlapping windows, and repeatability. Then `npm run build` succeeds and `npm run dev -- --host 127.0.0.1` starts Vite; verify the served dashboard responds without startup/runtime errors.
  Learner check: Open the running app, inspect the sample day, select **Add surprise lab**, and compare the proposal with the original. Check that completed work stays put and any unscheduled work is described honestly.
  Commit: `Build sample-day recovery proposal`

- [x] **2. You can edit valid tasks and keep the day after reload**
  Becomes usable: Acceptance criteria: valid task and fixed-commitment edits appear without refresh and survive reload; invalid task values show the exact PRD field messages without losing other form values or reaching the scheduler; a saved scheduling-input edit marks its prior proposal outdated and preserves that proposal snapshot.
  Why now: Once the core recovery behavior is visible, editing and persistence make its inputs personal and dependable. Keeping validation with the editing flow prevents invalid data from reaching the scheduler.
  PRD ref: `prd.md > Sample-Day Dashboard and Editing`, `Task Validation`, `Proposal Review, Approval, and Stale Data`
  Spec ref: `spec.md > Task and Commitment Forms`, `Input Validation and Error Handling`, `Local Persistence Module`, `Persistence Shape`, `Data Model`
  Build: Add accessible task and commitment forms with the specified validation messages and preserved form values; wire saved edits into planner state; persist the versioned state in browser local storage with explicit error notices; mark proposals based on prior scheduling inputs outdated while preserving their snapshots. Keep rollover behavior out of this slice; use same-date fixtures.
  Verify (mechanical): Acceptance checks: focused validation, reducer, and persistence tests pass for name/duration/deadline/preferred-window rules and exact messages, input retention, invalid-input exclusion, proposal invalidation with preserved snapshot, reload persistence, missing/malformed data recovery, and local-storage read/write failure notices. Run `npm run build`.
  Learner check: Add or edit a task with a valid value, reload the app to confirm it remains, then try an invalid duration and verify the message appears without losing the other form values.
  Commit: `Add validated editing and persistence`

- [x] **3. You can decide safely and reset the same-day demo**
  Becomes usable: Acceptance criteria: approval applies only a current proposal whose proposed incomplete starts have not passed and preserves fixed/completed items; rejection leaves accepted study placements and the fixed lab/conflict unchanged; same-day reset restores original sample sessions, clears the lab and proposal history, and shows the initial recovery preview.
  Why now: Explicit decisions complete the PRD's core recovery journey after the proposal and saved inputs exist. Clock and revision checks must be in place before any proposal can change the accepted schedule.
  PRD ref: `prd.md > The Core Journey` (steps 5–6), `Proposal Review, Approval, and Stale Data`, `Reset and Repeatability`
  Spec ref: `spec.md > Proposal Lifecycle and Clock-Safe Approval`, `Planner Reducer`, `Recovery Comparison`, `Important Failure Modes`
  Build: Implement atomic approval of only current proposals, time-safe invalidation when a proposed session start has passed, rejection that leaves accepted study sessions and the 4–6 PM lab unchanged, and ordinary same-day reset that restores the original sample and clears proposal history. Keep date-rollover detection and archiving out of this slice.
  Verify (mechanical): Acceptance checks: reducer and user-flow tests pass for valid atomic approval, outdated revision rejection, an elapsed proposed start leaving every accepted session unchanged, rejection retaining the fixed lab/conflict and accepted schedule, and reset restoring the original day plus initial recovery preview. Run `npm run test -- --run` and `npm run build`. Result (2026-10-14): 5 test files, 43 tests passed; TypeScript check and Vite production build passed.
  Learner check: Completed 2026-10-14. The learner confirmed approval applied revised placements while preserving completed work and fixed commitments; rejection kept the original schedule and fixed 4–6 PM lab; reset restored the October 14 sample day and initial recovery view with no lab or proposal comparison.
  Commit: `Add proposal decisions and same-day reset`

- [x] **4. You can preserve yesterday before starting today's sample**
  Becomes usable: Acceptance criteria: same-date reload does not archive; a different-date saved plan is read-only and blocks edits, scheduling, approval, and ordinary reset; cancelling leaves storage unchanged; confirming stores the entire old plan and proposal history as read-only and activates today's clean, no-lab sample; failed archive persistence keeps the previous day active and reports the failure.
  Why now: This safeguards local persistence across dates after the ordinary same-day journey already works, while keeping rollover distinct from the approved PRD reset.
  PRD ref: `prd.md > Reset and Repeatability` (ordinary same-day reset remains unchanged)
  Spec ref: `spec.md > Day-Rollover Notice and Archive Reference`, `ArchivedDay`, `Persistence Shape`, `Proposal Lifecycle and Clock-Safe Approval`, `Important Failure Modes`
  Build: Detect date rollover on load and page resume; block edits, scheduling, approval, and ordinary reset for the prior day; add cancel/confirm behavior; atomically archive the complete previous plan and proposal history before activating today's clean sample; report archive-write failures without switching the active day.
  Verify (mechanical): Acceptance checks: fixed-clock persistence/reducer tests pass for same-day reload, rollover detection and blocked actions, cancel without mutation, complete confirmed archive plus clean current-day sample, no duplicate archive on reload, and failed storage write retaining the old active day with an error. Run `npm run test -- --run` and `npm run build`.
  Learner check: Completed 2026-10-20. The learner verified that cancelling kept the prior plan unchanged and read-only, while confirming archived the complete plan and proposal history and opened today's clean sample with no lab or old active proposals. Reloading did not create a duplicate archive, and the previous day's data remained intact.
  Commit: `Preserve plans across date rollover`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 1, before remaining editing and lifecycle work
- [x] Final kick-the-tires exploration and feedback completed — after all slices and full verification

Early-check evidence: The learner exercised the running Slice 1 app, confirmed task outcomes and available-study-time accounting, and approved the slice.

Final-review checkpoint evidence (2026-10-20): The learner reports personally completing the recovery-flow and awkward-input review, including approval, rejection, validation behavior, and Penguin completion feedback on mobile. Cloudy is intentionally deferred because its original approved artwork is unavailable; no replacement was introduced. No new change request was reported.

## Final Review

- [x] Final review complete — feedback resolved and learner confirms ready to ship

Review evidence to date (2026-10-20): The learner's form check found the empty-name, duration, and deadline messages clear, with red borders helpful, and no validation issue. Focused `App.test.tsx` and `validation.test.ts` passed (32 tests). In an isolated browser origin, approving a proposal applied its revised sessions; rejecting preserved the original sessions and left the lab conflict visible. Empty/whitespace names and zero/negative durations were rejected without saving; an empty deadline showed its validation message, while the native date input rejected an impossible calendar date and the validator tests cover malformed dates. Correcting an invalid duration preserved the name and deadline, cleared the error, and enabled save; discarding the draft left stored tasks unchanged. Cancel/Escape checks left plans unchanged. No console errors or failed images were observed, and viewport checks at 320, 375, 768, and 1280 px found no horizontal overflow. The learner subsequently confirmed hands-on review of approval, rejection, awkward-input validation, and mobile Penguin feedback; Cloudy is intentionally deferred pending original approved artwork. No implementation fix was requested in this final review. The learner explicitly confirmed the proof of concept is ready to ship on 2026-10-20.

## Code Tour and App Map

- [x] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [x] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [x] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: Guided code route completed by the learner using the standalone app map. The completion flow was the worked example: the learner's mobile review exposed feedback that existed but was not in view; the latest implementation scrolls it into view, the focused `App.test.tsx` test checks that behavior, and the full suite/build passed after the fix.
Route and stops: `src/components/TaskForm.tsx` — `submit` validates before `onSave`; `src/App.tsx` — `taskCompletionFeedback`, task editor `onSave`, and the `role="status"` rendering/scroll effect; `src/App.test.tsx` — `shows the two task statuses and saves completion without rescheduling completed work`.
Edit outcome: Learner declined the optional wording edit and asked to keep the current Penguin completion message unchanged; no code was changed for the learning activity.
Reflection: Transfer question offered and answered by the learner; the personal response is recorded in the ignored learner profile.
Activity mode: Guided route in the learner's editor, with the reference map opened locally in the browser; app behavior was already hands-on reviewed by the learner.

## Revisions

- Slice 1 prioritizes the end-to-end recovery behavior and scheduler tests before visual polish while retaining a usable UI; date-rollover archiving is isolated to Slice 4 and is not a prerequisite for verifying Slices 1–3 — learner clarification during checklist approval.
- Slice 1 also verifies one outcome per sample task and shares the scheduler's remaining-availability calculation with the dashboard summary, so time labels cannot drift from clock/blocker rules — learner-requested final check.
