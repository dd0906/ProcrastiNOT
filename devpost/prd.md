---
doc: prd
status: approved
---

# ProcrastiNOT — Product Requirements

A student planner that helps a college student recover a study day after a fixed commitment disrupts it.
Source: `scope.md > The Unique Kernel`, `The Core Loop`, and `The POC Boundary`.

## The Core Journey

1. The student opens ProcrastiNOT and sees a populated, editable sample day, with the purpose of planning and recovering a study day made clear.
2. The student reviews the day's tasks and commitments and can add or edit them. Invalid task details are explained without losing the other entered values.
3. The student selects **Add surprise lab**. A fixed lab from 4–6 PM appears as an unexpected commitment; the original study schedule is not silently changed.
4. ProcrastiNOT creates a deterministic recovery proposal from the latest task and commitment data. The student can compare the original schedule with the proposal, see moved and unchanged work, and understand at-risk or unscheduled tasks.
5. The student explicitly approves the current proposal to apply its revised study schedule, or keeps the original schedule. Keeping the original dismisses the proposal but does not remove the lab; any resulting conflict remains visible.
6. The student can reset the sample day to its initial state and run the same demonstration again.

Source: `scope.md > The Core Loop` and `What "Working" Looks Like`.

## Screens and Layout

The MVP uses one primary dashboard; task editing and recovery-plan review stay within this dashboard rather than introducing separate product areas.

- **Header:** ProcrastiNOT name/logo, “Procrastinate? NOT today.” tagline, sample-day date, and a reset action.
- **Daily overview:** A brief supportive greeting and a compact summary of available study time, protected sleep, and separate highlights for overdue tasks, tasks due today, and approaching deadlines. Other non-completed tasks with later deadlines are labelled upcoming.
- **Today's schedule:** A readable single-day timeline containing sample classes and other fixed commitments, study sessions, breaks, and sleep. Fixed commitments and movable study sessions are visually distinct. Study tasks show their name, estimated duration, deadline, priority, and scheduled time.
- **Task and commitment editing:** A simple, beginner-friendly way to add or edit tasks and fixed commitments without a long form.
- **Recovery area:** Before simulation, a brief explanation of the recovery feature. After simulation, a proposal with the original and proposed schedules, change explanations, risk information, and explicit approval or keep-original actions.

Source: `scope.md > The Core Loop` and `What "Working" Looks Like`.

## Look and Feel

Use a calm, warm, minimal, modern layout with warm white, blush, lavender, butter yellow, and sage green. Keep the schedule easy to read and the recovery action prominent but friendly, not alarming. Use brief supportive language without guilt, excessive notifications, or intrusive gamification. Mascots are static illustrations shown selectively where they support an existing task or planning context; they do not add chat, reminders, task breakdown, mood tracking, or other planner behavior.

### Contextual Mascot Plan (Approved Extension)

- **Ghost — Main Study Companion:** remains the familiar brand mascot in the dashboard welcome area.
- **Penguin — Consistency Buddy:** appears as brief progress feedback after a task is saved as completed.
- **Hedgehog — Thoughtful Planner:** appears in the add/edit form for incomplete tasks with a planning tip. The planner still schedules whole tasks and does not break them into smaller steps.
- **Jumpclip — Quick-Action Helper:** appears beside the existing task-add action; it does not imply reminders or new task-management features.
- **Cloudy — Calm Companion:** the original approved artwork is not available in the project. Keep the break, reassurance, and mood-based Study Rescue role pending; do not display a broken image or create replacement artwork.

Source: `scope.md > Inspiration & Identity`; visual details were supplied during the PRD interview and align with the learner profile.

## Features and Behavior

### Sample-Day Dashboard and Editing

The dashboard starts with populated sample data, including fixed commitments, breaks, protected sleep, and study work that makes the surprise-lab conflict demonstrable. The learner can add or edit study tasks and fixed commitments. A task includes:

- Required name, estimated duration, deadline, and completion status.
- Priority: High, Medium, or Low. Medium is the visible default for a new task.
- Optional preferred study-time window. This is a soft preference, not the task deadline.
- Tasks are whole, continuous sessions in the MVP; they are never split or silently shortened.

When a valid task is saved, the dashboard reflects it immediately. If saved task or commitment data changes while a recovery proposal is being reviewed, the proposal is marked outdated and cannot be applied until a new proposal is generated.

- [ ] On first open, a populated sample day and a planned study session that conflicts with the 4–6 PM demo lab are visible without requiring setup.
- [ ] Every displayed study task exposes its name, estimated duration, deadline, priority, status, and scheduled time where scheduled.
- [ ] A new task visibly defaults to Medium priority; the student can change it.
- [ ] A saved valid task or commitment appears in the current day's dashboard without a page refresh.
- [ ] Completed tasks/sessions and fixed commitments remain unchanged by rescheduling and are not scheduled as new work.
- [ ] Changes to scheduling inputs make any open proposal visibly outdated and prevent its application.

Source: `scope.md > The Core Loop`, `The POC Boundary`, and `What "Working" Looks Like`.

### Task Validation

Validate task data before saving or sending it to the scheduler. Show field-specific inline messages and an accessible invalid-state indication that does not rely on colour alone. Preserve other entered values so the student can correct the input.

- **Name:** Required; trim surrounding whitespace; reject blank or whitespace-only values with “Please enter a task name.”
- **Estimated duration:** Required; accept numeric values greater than 0 and up to 480 minutes inclusive. Reject zero, negative, non-numeric, or above-480 values with “Duration must be between 1 and 480 minutes.” Do not silently clamp invalid values or replace them with a default.
- **Deadline:** Required and valid. Reject missing or invalid dates with “Please enter a valid deadline.” Use the student's local calendar date to label non-completed tasks: **Overdue** if the deadline has passed, **Due today** if it is today, **Approaching** if after today but within the next 3 calendar days, and **Upcoming** if more than 3 calendar days away. Completed tasks are not labelled overdue, due today, or approaching.
- **Priority:** Must be High, Medium, or Low; a new task may visibly default to Medium.
- **Preferred time:** Optional; if entered, it must be a valid window whose end is later than its start. A window conflicting with a fixed commitment does not invalidate the task.
- **Completion status:** Must be Not started, In progress, or Completed.
- Disable saving while required inputs are invalid and validate again on Save. Invalid tasks must not be added to the day or passed to the scheduler.

- [ ] Blank and whitespace-only names are rejected with the specified message; surrounding whitespace is trimmed on valid save.
- [ ] Numeric durations greater than 0 and up to 480 minutes inclusive are accepted; zero, negative, non-numeric, and above-480 values are rejected with “Duration must be between 1 and 480 minutes.” Other entered values remain present.
- [ ] Missing or invalid deadlines are rejected; a past deadline saves and is visibly overdue.
- [ ] Using the student's local calendar date, non-completed tasks are categorized as overdue, due today, approaching (next 3 calendar days), or upcoming (more than 3 days away); completed tasks are excluded from overdue/due-today/approaching categories.
- [ ] The daily summary separately highlights overdue, due-today, and approaching tasks with clear text labels and supportive language; task deadline categories are not conveyed by colour alone.
- [ ] These display categories do not change scheduler ordering, which uses the actual deadline.
- [ ] An end time equal to or earlier than the preferred start time is rejected; a conflicting but valid preferred window remains saveable.
- [ ] An invalid task neither appears in the schedule nor triggers recalculation. A valid correction can be saved and scheduled.
- [ ] Errors are understandable without technical knowledge and are conveyed by text as well as visual styling.

Source: `scope.md > The POC Boundary`.

### Surprise Lab and Recovery Proposal

Selecting **Add surprise lab** adds a clearly labelled, fixed 4–6 PM lab to the current day. The lab is never moved. The dashboard identifies its conflict with existing study work and creates a proposal without silently changing or applying the original study schedule.

The deterministic scheduler uses the latest valid tasks, actual deadlines, durations, priorities, preferred windows, available study time, fixed commitments, and protected sleep. Dashboard labels do not replace or alter actual deadline values. Completed sessions are preserved at their original times and are never scheduled again. If work cannot be placed, the scheduler leaves it unscheduled or at risk and tells the student why; it never hides unfinished work, shortens or splits it, or makes the day appear feasible by overbooking. Its product-level ordering and constraints are:

1. Fixed commitments, protected sleep, and completed work are preserved.
2. Earlier deadlines generally take precedence over later deadlines; deadline urgency takes precedence over task priority.
3. For equal deadlines, High precedes Medium, which precedes Low priority.
4. A preferred time window is tried when feasible, then other suitable available time is considered.
5. A task is scheduled as one continuous session only when a sufficiently long free slot exists. Tasks are not split, shortened, double-booked, or placed over fixed commitments or protected sleep.
6. If a task cannot fit before its deadline, show it as unscheduled or at risk and explain why in plain language. A task whose deadline has passed is identified as overdue.
7. Equal-deadline, equal-priority tasks use their original sample-schedule order as a consistent tie-breaker. The same inputs produce the same result.

The recovery area presents an immutable baseline/original plan alongside the proposed plan. It identifies the surprise lab, marks moved sessions, distinguishes unchanged and completed sessions, explains why affected sessions moved or could not move, and summarizes work that fits and deadlines/tasks at risk. Each comparison and explanation must refer to the exact schedule data version from which it was generated. The proposal is clearly labelled as awaiting approval.

- [ ] Adding the lab shows it at 4–6 PM as a fixed unexpected commitment and identifies overlapping study work.
- [ ] Generating a proposal does not silently apply it or change the original study schedule.
- [ ] Fixed commitments, protected sleep, and completed sessions remain unchanged and at their original times; no completed work is scheduled again.
- [ ] No proposed session overlaps a fixed commitment, completed session, or protected sleep.
- [ ] Earlier deadlines take precedence over later ones; priority orders tasks only when deadlines are equal.
- [ ] A preferred window is honoured when feasible, but a task is considered for other suitable slots when it is not.
- [ ] A task is either placed as one full continuous session or marked unscheduled/at risk; the schedule never shortens or splits it or overbooks time.
- [ ] Every task that cannot fit before its deadline remains visibly unscheduled or at risk and includes a plain-language reason; the proposal does not imply unfinished work is complete or that an infeasible day fits.
- [ ] Equal-deadline, equal-priority work follows its original sample order, and identical inputs produce the same schedule and explanations.
- [ ] The comparison uses the unchanged source baseline and matching input version, visibly identifies moved, unchanged, and completed sessions, explains affected decisions, summarizes what fits and what is at risk, and labels the result as a proposal.

Source: `scope.md > The Unique Kernel`, `The Core Loop`, `What "Working" Looks Like`, and `The POC Boundary`.

### Proposal Review, Approval, and Stale Data

The student has two explicit actions: **Approve revised plan** and **Keep original plan**. Approval applies only a current proposal generated from the latest task and commitment data. Keeping the original dismisses the proposal without applying its study-session changes; the surprise lab remains a real fixed commitment in its 4–6 PM slot, and any resulting conflict stays visible. Rejecting a proposal never removes, moves, or treats the lab as simulated-away.

If task or commitment data changes while a proposal is open:

- Keep the proposal and its explanations intact for reference and mark it **Outdated**.
- Show: “Your tasks have changed since this recovery plan was created. Review an updated plan before applying changes.”
- Let the student continue to inspect the outdated proposal, generate an updated proposal from the latest data, or cancel the edit without changing the underlying task data.
- Keep the prior baseline and proposal unchanged for reference. A regenerated proposal is compared against the appropriate current baseline.
- Never apply an outdated proposal or automatically apply a newly generated proposal. Repeated edits make the currently open proposal outdated again.

- [ ] Approving a current proposal applies the proposed study schedule and leaves fixed commitments, completed work, and protected sleep unchanged.
- [ ] Keeping the original dismisses the proposal without applying its moved sessions; the surprise lab remains and any conflict is visible.
- [ ] After rejection, the surprise lab remains fixed from 4–6 PM and any conflict with the retained study schedule stays visible.
- [ ] A proposal generated from older task/commitment data is visibly Outdated and cannot be approved.
- [ ] The specified stale-data notice appears after an edit; the previous proposal remains inspectable and unchanged.
- [ ] Generating an updated proposal uses the latest valid data, compares against the appropriate current baseline, and remains unapplied until explicit approval.
- [ ] Cancelling an edit leaves the saved task/commitment data unchanged; repeating an edit while reviewing a proposal marks that proposal Outdated.

Source: `scope.md > The Core Loop` and `The POC Boundary`.

### Reset and Repeatability

The reset action restores the original sample tasks and commitments, removes the simulated surprise lab, clears old proposals, and returns the dashboard to its initial state.

- [ ] After reset, the sample data and original schedule are restored, the surprise lab and prior proposals are gone, and the initial recovery preview is shown.
- [ ] The student can add the surprise lab again and see the same result when the sample inputs are unchanged.

Source: `scope.md > What "Working" Looks Like` and `The POC Boundary`.

## States and Boundaries

- **First use:** Show populated sample data and the initial recovery preview; the student does not have to create data before understanding the product.
- **Normal use:** Show one editable sample day and its fixed commitments, tasks, study sessions, breaks, and protected sleep.
- **Invalid task input:** Identify the invalid field, preserve other form values, and prevent saving and scheduling until corrected.
- **Overdue or at-risk work:** Distinguish overdue tasks from work that cannot fit before a future deadline; give a plain-language reason for unscheduled work.
- **Proposal awaiting review:** Show both plans and the explicit approve/keep-original actions; do not apply changes automatically.
- **Outdated proposal:** Preserve it for inspection, show the stale-data notice, and prevent approval until a current proposal is generated.
- **Reset:** Return to the initial sample state and clear the simulated lab and proposal history.
- **Out of scope:** No weekly/multi-day planner, authentication, sticky notes, reminders, timer, AI study-material assistance, AI/API scheduling, or visual-only scheduling mock-up. Task splitting is deferred.

Source: `scope.md > The POC Boundary`, `Later`, and `Explicitly Cut`.

## Product Decisions

- Keep the product a sample-centered, single-day proof of concept; focus on the surprise-lab recovery loop rather than broad planner features.
- Use deterministic, explainable scheduling. Deadline urgency outranks priority; priority breaks equal-deadline ties; preferred time is soft.
- Highlight overdue, due-today, approaching, and upcoming tasks using the student's local calendar date; completed tasks are excluded from overdue/due-today/approaching highlights.
- Never move fixed commitments, protected sleep, or completed work. Do not overbook, shorten, or silently split tasks.
- Keep schedule changes proposed until the student explicitly approves them.
- Preserve an outdated proposal for inspection but make it impossible to apply against changed input data.
- Task splitting is not an MVP requirement; defer it as a possible later enhancement.
- Use a calm, warm, minimal, supportive identity and the learner-provided soft colour palette; avoid guilt-based or intrusive interactions.

## What We're Building

One populated, editable student sample-day dashboard; task and fixed-commitment editing with validation; a repeatable 4–6 PM surprise-lab scenario; deterministic whole-task rescheduling that respects deadlines, fixed commitments, completed work, available study time, and protected sleep; explained before-and-after proposals with at-risk work; explicit approval or keep-original behavior; stale-proposal protection; and reset to the original demo state.

## Deferred From the POC

- **Task splitting and partial-session progress tracking:** Defer to protect the 2–4-hour active-work target and keep whole-task recovery reliable.
- **Full weekly or multi-day planning:** The proof demonstrates one disrupted sample day.
- **Sticky notes, reminders, a study timer, and AI-assisted study materials:** These do not prove the rescheduling kernel.
- **Authentication and account features:** Not needed for the sample-centered demonstration.
- **Interactive study-buddy features:** Contextual static mascot illustrations are approved as described above; interactive or AI-generated companion behavior is not required.

Source: `scope.md > Later` and `The POC Boundary`.

## Possible Later Enhancements

- Allow tasks to be marked as splittable, with minimum useful session lengths and accurate scheduled/completed-duration tracking.
- Expand the single-day recovery planner into a weekly or multi-day planner.
- Add the deferred student-productivity and study-buddy features if the core planner proves useful.

## Non-Goals

- Replacing the scheduling proof with a generic to-do list or chatbot.
- AI/API-generated scheduling decisions; the MVP scheduler must be deterministic and explainable.
- A visual-only mock-up that does not recalculate a schedule.
- Automatically applying a recovery plan, moving fixed commitments or completed work, using protected sleep, or pretending an infeasible workload fits.

Source: `scope.md > Explicitly Cut`.

## Open Questions

- **Can be resolved in `4-spec`:** The exact algorithm for assigning available time slots and producing per-task explanations, while preserving the product-level ordering and constraints above.
- **Can be resolved in `4-spec`:** The precise sample-day entries and the mechanics of the compact task/commitment editor, provided all stated requirements remain testable and within scope.
