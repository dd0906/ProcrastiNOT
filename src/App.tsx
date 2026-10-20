import { useEffect, useReducer, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, RefObject, SyntheticEvent } from "react";
import { localDateString } from "./data/sampleDay";
import { createRecoveryProposal, getRemainingStudyMinutes } from "./logic/scheduler";
import { plannerReducer } from "./state/plannerReducer";
import {
  archivePreviousDay,
  loadPlannerState,
  ROLLOVER_FAILURE_NOTICE,
  savePlannerState,
  type StorageLike,
} from "./storage/persistence";
import TaskForm from "./components/TaskForm";
import CommitmentForm from "./components/CommitmentForm";
import type {
  ArchivedDay,
  DayPlan,
  FixedCommitment,
  RecoveryProposal,
  StudySession,
  Task,
  TimeInterval,
} from "./types/planner";

interface TimelineItem {
  id: string;
  title: string;
  startMinute: number;
  endMinute: number;
  kind: "commitment" | "study" | "completed" | "break";
  detail?: string;
  isSimulated?: boolean;
}

function formatTime(totalMinutes: number): string {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const suffix = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

function calendarDayDifference(date: string, today: string): number {
  const [year, month, day] = today.split("-").map(Number);
  const [targetYear, targetMonth, targetDay] = date.split("-").map(Number);
  const todayLocal = new Date(year, month - 1, day);
  const targetLocal = new Date(targetYear, targetMonth - 1, targetDay);
  return Math.round((targetLocal.getTime() - todayLocal.getTime()) / (24 * 60 * 60 * 1000));
}

function deadlineLabel(task: Task, today: string): string | undefined {
  if (task.status === "completed") {
    return undefined;
  }
  const days = calendarDayDifference(task.deadlineDate, today);
  if (days < 0) return "Overdue";
  if (days === 0) return "Due today";
  if (days <= 3) return "Approaching";
  return "Upcoming";
}

function makeTimelineItems(
  day: DayPlan,
  sessions: StudySession[],
  includeBreaks: boolean,
): TimelineItem[] {
  const taskById = new Map(day.tasks.map((task) => [task.id, task]));
  const items: TimelineItem[] = [
    ...day.commitments.map((commitment: FixedCommitment) => ({
      id: commitment.id,
      title: commitment.title,
      startMinute: commitment.startMinute,
      endMinute: commitment.endMinute,
      kind: "commitment" as const,
      detail: commitment.isSimulated ? "Fixed surprise lab" : "Fixed commitment",
      isSimulated: commitment.isSimulated,
    })),
    ...sessions.map((session) => {
      const task = taskById.get(session.taskId);
      return {
        id: session.id,
        title: task?.name ?? "Study session",
        startMinute: session.startMinute,
        endMinute: session.endMinute,
        kind: session.status === "completed" ? ("completed" as const) : ("study" as const),
        detail: task
          ? `${task.durationMinutes} min · ${task.priority} priority · ${deadlineLabel(task, day.date) ?? "Completed"}`
          : undefined,
      };
    }),
  ];

  if (includeBreaks) {
    items.push(
      ...day.unavailablePeriods.map((period: TimeInterval, index) => ({
        id: `unavailable-${index}`,
        title: "Lunch break",
        startMinute: period.startMinute,
        endMinute: period.endMinute,
        kind: "break" as const,
        detail: "Unavailable time",
      })),
    );
  }

  return items.sort((left, right) => left.startMinute - right.startMinute || left.endMinute - right.endMinute);
}

function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="timeline">
      {items.map((item) => (
        <li className={`timeline-item timeline-item--${item.kind}`} key={item.id}>
          <time className="timeline-time">
            {formatTime(item.startMinute)}–{formatTime(item.endMinute)}
          </time>
          <span className="timeline-marker" aria-hidden="true" />
          <div className="timeline-copy">
            <strong>{item.title}</strong>
            <span>
              {item.detail}
              {item.isSimulated && <span className="fixed-tag">Surprise lab</span>}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function PlanColumn({
  day,
  sessions,
  title,
  isProposal = false,
  proposalStatus = "current",
}: {
  day: DayPlan;
  sessions: StudySession[];
  title: string;
  isProposal?: boolean;
  proposalStatus?: RecoveryProposal["status"];
}) {
  const items = makeTimelineItems(day, sessions, true);
  const proposalLabel = {
    current: "Awaiting your review",
    outdated: "Outdated snapshot",
    approved: "Approved",
    rejected: "Rejected",
  }[proposalStatus];

  return (
    <section
      aria-label={title}
      className={`plan-column${isProposal ? " plan-column--proposal" : ""}`}
    >
      <div className="plan-column-heading">
        <div>
          <p className="eyebrow">
            {isProposal
              ? proposalStatus === "approved"
                ? "Applied plan"
                : proposalStatus === "outdated"
                  ? "Outdated snapshot"
                  : proposalStatus === "rejected"
                    ? "Kept original"
                    : "Not applied"
              : "Baseline"}
          </p>
          <h3>{title}</h3>
        </div>
        {isProposal && (
          <span className="status-pill">{proposalLabel}</span>
        )}
      </div>
      <Timeline items={items} />
    </section>
  );
}

function deadlineSummary(tasks: Task[], today: string) {
  return tasks.reduce(
    (summary, task) => {
      const label = deadlineLabel(task, today);
      if (label === "Overdue") summary.overdue += 1;
      if (label === "Due today") summary.today += 1;
      if (label === "Approaching") summary.approaching += 1;
      return summary;
    },
    { overdue: 0, today: 0, approaching: 0 },
  );
}

function findLabConflicts(day: DayPlan): string[] {
  const taskById = new Map(day.tasks.map((task) => [task.id, task.name]));
  return day.commitments
    .filter((commitment) => commitment.isSimulated)
    .flatMap((lab) =>
      day.acceptedSessions
        .filter(
          (session) =>
            session.status === "planned" &&
            session.startMinute < lab.endMinute &&
            session.endMinute > lab.startMinute,
        )
        .map(
          (session) =>
            `${taskById.get(session.taskId) ?? "A study session"} overlaps the fixed ${lab.title.toLowerCase()} from ${formatTime(lab.startMinute)} to ${formatTime(lab.endMinute)}.`,
        ),
    );
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function outcomeLabel(outcome: RecoveryProposal["outcomes"][number], task?: Task): string {
  if (task?.status === "completed") return "Completed";
  if (outcome.comparison === "moved") return "Moved";
  if (outcome.comparison === "unchanged") return "Unchanged";
  if (outcome.comparison === "scheduled") return "New placement";
  return outcome.state === "atRisk" ? "At risk" : "Not scheduled today";
}

function ArchiveReference({ archives }: { archives: ArchivedDay[] }) {
  if (archives.length === 0) return null;

  return (
    <section className="section-card archive-section" aria-label="Archived days">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Read-only reference</p>
          <h2>Archived days</h2>
        </div>
      </div>
      {archives.map((archive) => (
        <details className="archive-day" key={archive.id}>
          <summary>View saved plan from {formatDate(archive.date)}</summary>
          <div className="archive-content">
            <h3>Saved schedule</h3>
            <Timeline items={makeTimelineItems(archive.dayPlan, archive.dayPlan.acceptedSessions, true)} />
            <h3>Tasks from this day</h3>
            <ul className="editable-list" aria-label={`Archived tasks from ${archive.date}`}>
              {archive.dayPlan.tasks.map((task) => (
                <li key={task.id}>
                  <div>
                    <strong>{task.name}</strong>
                    <span>
                      {task.durationMinutes} min · Due {task.deadlineDate} · {task.priority} · {task.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <h3>Saved proposal history ({archive.proposals.length})</h3>
            {archive.proposals.length === 0 ? (
              <p>No recovery proposals were saved for this day.</p>
            ) : (
              archive.proposals.map((proposal, index) => (
                <details className="archive-proposal" key={`${archive.id}-proposal-${index}`}>
                  <summary>Proposal {index + 1} · {proposal.status}</summary>
                  <div className="comparison-grid">
                    <PlanColumn
                      day={proposal.baseline}
                      sessions={proposal.baseline.acceptedSessions}
                      title="Plan before decision"
                    />
                    <PlanColumn
                      day={proposal.baseline}
                      sessions={proposal.proposedSessions}
                      title="Suggested plan"
                      isProposal
                      proposalStatus={proposal.status}
                    />
                  </div>
                </details>
              ))
            )}
          </div>
        </details>
      ))}
    </section>
  );
}

interface ConfirmationDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  fallbackFocusRef: RefObject<HTMLElement | null>;
  onConfirm(): void;
  onCancel(): void;
}

function ConfirmationDialog({
  title,
  description,
  confirmLabel,
  fallbackFocusRef,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const activeElement = document.activeElement;
    returnFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    dialog.showModal();
    cancelButtonRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      const opener = returnFocusRef.current;
      if (opener?.isConnected && !(opener instanceof HTMLButtonElement && opener.disabled)) {
        opener.focus();
      } else {
        fallbackFocusRef.current?.focus();
      }
    };
  }, [fallbackFocusRef]);

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    onCancel();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    onCancel();
  }

  return (
    <dialog
      ref={dialogRef}
      className="editor-dialog confirmation-dialog"
      aria-labelledby="confirmation-dialog-title"
      aria-describedby="confirmation-dialog-description"
      aria-modal="true"
      onCancel={handleCancel}
      onKeyDown={handleKeyDown}
    >
      <div className="discard-confirmation">
        <h4 id="confirmation-dialog-title">{title}</h4>
        <p id="confirmation-dialog-description">{description}</p>
        <div className="form-actions">
          <button ref={cancelButtonRef} className="secondary-button" type="button" onClick={onCancel}>Cancel</button>
          <button className="primary-button" type="button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </dialog>
  );
}

function browserStorage(): StorageLike {
  return {
    getItem(key) {
      return window.localStorage.getItem(key);
    },
    setItem(key, value) {
      window.localStorage.setItem(key, value);
    },
  };
}

export default function App() {
  const [planner, dispatch] = useReducer(
    plannerReducer,
    undefined,
    () => {
      const loaded = loadPlannerState(browserStorage(), localDateString(new Date()));
      return { ...loaded.state, notice: loaded.notice };
    },
  );
  const [today, setToday] = useState(() => localDateString(new Date()));
  const [taskEditor, setTaskEditor] = useState<{ task?: Task } | null>(null);
  const [taskCompletionFeedback, setTaskCompletionFeedback] = useState<string | null>(null);
  const taskCompletionFeedbackRef = useRef<HTMLDivElement>(null);
  const [commitmentEditor, setCommitmentEditor] = useState<{ commitment?: FixedCommitment } | null>(null);
  const [showRolloverConfirmation, setShowRolloverConfirmation] = useState(false);
  const [showLabConfirmation, setShowLabConfirmation] = useState(false);
  const recoveryTitleRef = useRef<HTMLHeadingElement>(null);
  const welcomeTitleRef = useRef<HTMLHeadingElement>(null);
  const day = planner.day;
  const proposal = planner.proposals.at(-1) ?? null;
  const currentDate = today;
  const now = new Date();
  const nowMinute = now.getHours() * 60 + now.getMinutes();
  const summary = deadlineSummary(day.tasks, day.date);
  const labAdded = day.commitments.some((commitment) => commitment.isSimulated);
  const labConflicts = findLabConflicts(day);
  const proposalLabel = proposal
    ? {
        current: "Not applied",
        outdated: "Outdated",
        approved: "Approved",
        rejected: "Rejected",
      }[proposal.status]
    : undefined;

  useEffect(() => {
    if (planner.notice === ROLLOVER_FAILURE_NOTICE) return;
    const notice = savePlannerState(browserStorage(), planner);
    if (notice && notice !== planner.notice) {
      dispatch({ type: "persistence/notice", notice });
    }
  }, [planner]);

  useEffect(() => {
    function checkLocalDate() {
      if (document.visibilityState !== "hidden") {
        const localDate = localDateString(new Date());
        setToday(localDate);
        dispatch({ type: "day/date-checked", today: localDate });
      }
    }
    document.addEventListener("visibilitychange", checkLocalDate);
    window.addEventListener("focus", checkLocalDate);
    return () => {
      document.removeEventListener("visibilitychange", checkLocalDate);
      window.removeEventListener("focus", checkLocalDate);
    };
  }, []);

  useEffect(() => {
    dispatch({ type: "day/date-checked", today });
  }, [today, day.date]);

  useEffect(() => {
    if (planner.readOnly) {
      setTaskEditor(null);
      setTaskCompletionFeedback(null);
      setCommitmentEditor(null);
      setShowRolloverConfirmation(false);
      setShowLabConfirmation(false);
    }
  }, [planner.readOnly]);

  useEffect(() => {
    if (taskCompletionFeedback) {
      taskCompletionFeedbackRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [taskCompletionFeedback]);

  function addSurpriseLab() {
    if (planner.readOnly || labAdded) return;
    const commitment: FixedCommitment = {
      id: "surprise-lab",
      title: "Surprise lab",
      kind: "lab",
      startMinute: 16 * 60,
      endMinute: 18 * 60,
      isSimulated: true,
    };
    const updatedDay: DayPlan = {
      ...day,
      commitments: [...day.commitments, commitment],
      inputRevision: day.inputRevision + 1,
    };
    dispatch({ type: "commitment/saved", commitment });
    dispatch({
      type: "proposal/generated",
      proposal: createRecoveryProposal(updatedDay, nowMinute),
    });
  }

  function approveProposal() {
    if (planner.readOnly) return;
    const now = new Date();
    dispatch({
      type: "proposal/approved",
      nowMinute: now.getHours() * 60 + now.getMinutes(),
    });
  }

  function generateUpdatedProposal() {
    if (planner.readOnly) return;
    const now = new Date();
    dispatch({
      type: "proposal/generated",
      proposal: createRecoveryProposal(day, now.getHours() * 60 + now.getMinutes()),
    });
  }

  function resetSampleDay() {
    if (planner.readOnly) return;
    setTaskEditor(null);
    setTaskCompletionFeedback(null);
    setCommitmentEditor(null);
    dispatch({ type: "day/reset", date: localDateString(new Date()) });
  }

  function startTodaysSampleDay() {
    const rolloverDate = localDateString(new Date());
    const result = archivePreviousDay(
      browserStorage(),
      planner,
      rolloverDate,
      new Date().toISOString(),
    );
    setToday(rolloverDate);
    if (result.status === "failed") {
      dispatch({ type: "persistence/notice", notice: result.notice });
      return;
    }
    setShowRolloverConfirmation(false);
    setTaskEditor(null);
    setTaskCompletionFeedback(null);
    setCommitmentEditor(null);
    if (result.status === "saved") {
      dispatch({
        type: "day/rollover-started",
        today: rolloverDate,
        archives: result.state.archives,
      });
    } else {
      dispatch({ type: "day/date-checked", today: rolloverDate });
    }
  }

  const baselineSessions = proposal?.baseline.acceptedSessions ?? day.acceptedSessions;
  const proposedSessions = proposal?.proposedSessions;
  const nextTaskOrder = day.tasks.reduce((next, task) => Math.max(next, task.originalOrder + 1), 0);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="ProcrastiNOT home">
          <img
            className="brand-logo"
            src="/assets/procrastinot-header-logo.png"
            alt="ProcrastiNOT ghost mascot and wordmark"
          />
        </a>
        <div className="topbar-actions">
          <span className="local-badge"><span /> Local sample day</span>
          <button
            className="secondary-button"
            onClick={resetSampleDay}
            disabled={planner.readOnly}
          >
            Reset sample day
          </button>
        </div>
      </header>

      <div id="top" className="dashboard">
        {planner.notice && <p className="storage-notice" role="status">{planner.notice}</p>}
        {planner.readOnly && (
          <section className="rollover-notice" aria-label="Previous day is read-only">
            <div>
              <strong>This plan belongs to a different day. Your saved work is preserved.</strong>
              <p>{formatDate(day.date)} is available as a read-only reference until you start today's sample.</p>
            </div>
            <button
              className="primary-button"
              onClick={() => setShowRolloverConfirmation(true)}
            >
              Start Today's Sample Day
            </button>
          </section>
        )}
        <section className="welcome-card">
          <div className="welcome-copy">
            <p className="eyebrow">Your study day, with room to recover</p>
            <h1 ref={welcomeTitleRef} tabIndex={-1}>Make a plan.<br />Life happens. <span>We adjust.</span></h1>
            <p className="welcome-text">
              A calm place to find your next study step when the day takes an unexpected turn.
            </p>
            <p className="today-date">{formatDate(day.date)}</p>
          </div>
          <img
            className="buddy"
            src="/assets/procrastinot-primary-mascot.png"
            alt="ProcrastiNOT ghost mascot holding a notebook and pen"
          />
          <div className="welcome-decoration" aria-hidden="true" />
        </section>

        <section className="summary-grid" aria-label="Today's planning summary">
          <article className="summary-card summary-card--time">
            <span className="summary-icon" aria-hidden="true">◷</span>
            <div>
              <p>Available study time</p>
              <strong>{formatDuration(getRemainingStudyMinutes(day, nowMinute))}</strong>
            </div>
          </article>
          <article className="summary-card summary-card--sleep">
            <span className="summary-icon" aria-hidden="true">☾</span>
            <div>
              <p>Protected sleep</p>
              <strong>10:30 PM – 7:00 AM</strong>
            </div>
          </article>
          <article className="summary-card summary-card--deadlines">
            <span className="summary-icon" aria-hidden="true">✦</span>
            <div>
              <p>Deadlines to keep in view</p>
              <strong>
                {summary.overdue} overdue · {summary.today} due today · {summary.approaching} approaching
              </strong>
            </div>
          </article>
        </section>

        <section className="section-card schedule-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">One day at a time</p>
              <h2>Today's schedule</h2>
            </div>
            <span className="day-chip">Local day · {day.date === currentDate ? "Today" : day.date}</span>
          </div>
          <div className="legend" aria-label="Schedule legend">
            <span><i className="legend-dot legend-dot--fixed" /> Fixed commitment</span>
            <span><i className="legend-dot legend-dot--study" /> Study session</span>
            <span><i className="legend-dot legend-dot--done" /> Completed</span>
          </div>
          <Timeline items={makeTimelineItems(day, day.acceptedSessions, true)} />
          {labConflicts.length > 0 && (
            <div className="conflict-notice" role="status">
              <strong>Schedule conflict</strong>
              <ul>
                {labConflicts.map((conflict) => <li key={conflict}>{conflict}</li>)}
              </ul>
              <span>The original plan is unchanged while you review the proposal.</span>
            </div>
          )}
          <div className="sleep-note"><span aria-hidden="true">☾</span> Sleep is protected from 10:30 PM to 7:00 AM.</div>
        </section>

        <section className="section-card editor-section" aria-labelledby="tasks-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Your workload</p>
              <h2 id="tasks-title">Study tasks</h2>
            </div>
            <div className="task-add-action">
              <img
                src="/assets/procrastinot-jumpclip-mascot.png"
                alt="Jumpclip, the quick-action helper"
              />
              <button
                className="secondary-button"
                onClick={() => {
                  setTaskCompletionFeedback(null);
                  setTaskEditor({});
                }}
                disabled={planner.readOnly}
              >
                Add task
              </button>
            </div>
          </div>
          <ul className="editable-list" aria-label="Study tasks">
            {day.tasks.map((task) => (
              <li key={task.id}>
                <div>
                  <strong>{task.name}</strong>
                  <span>{task.durationMinutes} min · Due {task.deadlineDate} · {task.priority} · {task.status === "completed" ? "Completed" : "Not completed"}</span>
                </div>
                <button
                  className="text-button"
                  onClick={() => {
                    setTaskCompletionFeedback(null);
                    setTaskEditor({ task });
                  }}
                  disabled={planner.readOnly}
                >
                  Edit task
                </button>
              </li>
            ))}
          </ul>
          {taskCompletionFeedback && (
            <div ref={taskCompletionFeedbackRef} className="progress-feedback" role="status">
              <img
                src="/assets/procrastinot-penguin-mascot.png"
                alt="Penguin, the consistency buddy"
              />
              <p><strong>Nice progress:</strong> {taskCompletionFeedback} is marked complete.</p>
            </div>
          )}
          {!planner.readOnly && taskEditor && (
            <TaskForm
              key={taskEditor.task?.id ?? "new-task"}
              existingTask={taskEditor.task}
              nextOriginalOrder={nextTaskOrder}
              onSave={(task) => {
                setTaskCompletionFeedback(
                  task.status === "completed" && taskEditor.task?.status !== "completed"
                    ? task.name
                    : null,
                );
                dispatch({ type: "task/saved", task });
                setTaskEditor(null);
              }}
              onCancel={() => setTaskEditor(null)}
            />
          )}
          <div className="commitments-heading">
            <div>
              <h3>Fixed commitments</h3>
              <p>These stay in place when a recovery plan is calculated.</p>
            </div>
            <button className="secondary-button" onClick={() => setCommitmentEditor({})} disabled={planner.readOnly}>Add commitment</button>
          </div>
          <ul className="editable-list" aria-label="Fixed commitments">
            {day.commitments.map((commitment) => (
              <li key={commitment.id}>
                <div>
                  <strong>{commitment.title}{commitment.isSimulated && <span className="fixed-tag">Surprise lab</span>}</strong>
                  <span>{formatTime(commitment.startMinute)}–{formatTime(commitment.endMinute)} · {commitment.isSimulated ? "Fixed surprise" : commitment.kind}</span>
                </div>
                {!commitment.isSimulated && (
                  <button className="text-button" onClick={() => setCommitmentEditor({ commitment })} disabled={planner.readOnly}>Edit commitment</button>
                )}
              </li>
            ))}
          </ul>
          {!planner.readOnly && commitmentEditor && (
            <CommitmentForm
              key={commitmentEditor.commitment?.id ?? "new-commitment"}
              existingCommitment={commitmentEditor.commitment}
              onSave={(commitment) => {
                dispatch({ type: "commitment/saved", commitment });
                setCommitmentEditor(null);
              }}
              onCancel={() => setCommitmentEditor(null)}
            />
          )}
        </section>

        <section className="recovery-card">
          <div className="recovery-copy">
            <p className="eyebrow">A change to your day?</p>
            <h2>Try a recovery plan</h2>
            <p>
              Add the repeatable surprise lab and see a realistic schedule proposal. Your current study plan
              stays in place until you choose to approve a change.
            </p>
          </div>
          {proposal && (proposal.status === "outdated" || proposal.status === "rejected") ? (
            <button className="primary-button" onClick={generateUpdatedProposal} disabled={planner.readOnly}>
              <span aria-hidden="true">✦</span>
              Generate updated plan
            </button>
          ) : (
            <button
              className="primary-button"
              onClick={() => setShowLabConfirmation(true)}
              disabled={labAdded || planner.readOnly}
            >
              <span aria-hidden="true">✦</span>
              {labAdded ? "Surprise lab added" : "Add surprise lab"}
            </button>
          )}
        </section>

        {proposal && proposedSessions && (
          <section className="section-card proposal-section" aria-labelledby="proposal-title">
            <div className="section-heading proposal-heading">
              <div>
                <p className="eyebrow">A proposal, not an automatic change</p>
                <h2 id="proposal-title" ref={recoveryTitleRef} tabIndex={-1}>Your recovery plan</h2>
                <p className="section-description">
                  {proposal.status === "outdated"
                    ? "This saved comparison shows the plan calculated from the earlier inputs."
                    : "The lab is fixed from 4:00–6:00 PM. Review what would move before making any changes."}
                </p>
              </div>
              <span className={`proposal-badge${proposal.status === "outdated" ? " proposal-badge--outdated" : ""}`}>
                <span /> {proposalLabel}
              </span>
            </div>
            {proposal.status === "outdated" && (
              <div className="outdated-notice" role="status">
                {proposal.outdatedReason}
              </div>
            )}
            <div className="comparison-grid">
              <PlanColumn
                day={proposal.baseline}
                sessions={baselineSessions}
                title={proposal.status === "current" ? "Current plan" : "Plan before decision"}
              />
              <PlanColumn
                day={proposal.baseline}
                sessions={proposedSessions}
                title={proposal.status === "approved" ? "Approved plan" : "Suggested plan"}
                isProposal
                proposalStatus={proposal.status}
              />
            </div>
            <div className="outcomes">
              <h3>What changed and why</h3>
              <ul aria-label="Task outcomes">
                {proposal.outcomes.map((outcome) => {
                  const task = proposal.baseline.tasks.find(({ id }) => id === outcome.taskId);
                  return (
                    <li key={outcome.taskId}>
                      <span className={`outcome-tag outcome-tag--${outcome.state}`}>
                        {outcomeLabel(outcome, task)}
                      </span>
                      <span>
                        <strong>{task?.name ?? "Study task"}</strong>
                        <span className="outcome-reason">{outcome.reason}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            {proposal.status === "current" && !planner.readOnly && (
              <div className="proposal-actions">
                <button className="primary-button" onClick={approveProposal}>Approve revised plan</button>
                <button
                  className="secondary-button"
                  onClick={() => dispatch({ type: "proposal/rejected" })}
                >
                  Keep original plan
                </button>
              </div>
            )}
            <p className="proposal-footnote">
              {proposal.status === "current" && "This proposal has not been applied. Your accepted schedule stays in place until you decide."}
              {proposal.status === "outdated" && "Its original comparison is preserved for reference; the changed inputs need a new proposal."}
              {proposal.status === "approved" && "The revised study placements are now part of your accepted schedule."}
              {proposal.status === "rejected" && "The original study placements remain. The fixed surprise lab and any conflict are still shown."}
            </p>
          </section>
        )}

        <ArchiveReference archives={planner.archives} />

        <footer className="footer-note">
          <span>Small steps count.</span> ProcrastiNOT keeps the plan honest, not perfect.
        </footer>
      </div>
      {showRolloverConfirmation && planner.readOnly && (
        <ConfirmationDialog
          title="Start today's sample day?"
          description={`${formatDate(day.date)} and its complete recovery proposal history will be archived for reference. Today's clean sample will become active.`}
          confirmLabel="Confirm and start today's sample"
          fallbackFocusRef={welcomeTitleRef}
          onCancel={() => setShowRolloverConfirmation(false)}
          onConfirm={startTodaysSampleDay}
        />
      )}
      {showLabConfirmation && !planner.readOnly && !labAdded && (
        <ConfirmationDialog
          title="Add the surprise lab?"
          description="A fixed 4:00–6:00 PM lab will be added and a recovery proposal generated. Your accepted study schedule will stay unchanged unless you approve that proposal."
          confirmLabel="Add lab and create proposal"
          fallbackFocusRef={recoveryTitleRef}
          onCancel={() => setShowLabConfirmation(false)}
          onConfirm={() => {
            addSurpriseLab();
            setShowLabConfirmation(false);
          }}
        />
      )}
    </main>
  );
}
