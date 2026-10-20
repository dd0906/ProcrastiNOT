import type {
  DayPlan,
  RecoveryProposal,
  StudySession,
  Task,
  TaskOutcome,
  TimeInterval,
} from "../types/planner";

const PRIORITY_ORDER: Record<Task["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function normalizeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  const sorted = intervals
    .filter(({ startMinute, endMinute }) => endMinute > startMinute)
    .map(({ startMinute, endMinute }) => ({ startMinute, endMinute }))
    .sort((left, right) => left.startMinute - right.startMinute || left.endMinute - right.endMinute);
  const merged: TimeInterval[] = [];

  for (const interval of sorted) {
    const last = merged.at(-1);
    if (last && interval.startMinute <= last.endMinute) {
      last.endMinute = Math.max(last.endMinute, interval.endMinute);
    } else {
      merged.push(interval);
    }
  }
  return merged;
}

function remainingAvailability(day: DayPlan, nowMinute: number): TimeInterval[] {
  let free = normalizeIntervals(
    day.availabilityWindows
      .map(({ startMinute, endMinute }) => ({
        startMinute: Math.max(startMinute, nowMinute, 0),
        endMinute: Math.min(endMinute, 24 * 60),
      }))
      .filter(({ startMinute, endMinute }) => endMinute > startMinute),
  );

  const blockers = normalizeIntervals([
    ...day.commitments,
    ...day.protectedSleep,
    ...day.unavailablePeriods,
    ...day.acceptedSessions.filter(({ status }) => status === "completed"),
  ]);

  for (const blocker of blockers) {
    free = free.flatMap((slot) => {
      if (blocker.endMinute <= slot.startMinute || blocker.startMinute >= slot.endMinute) {
        return [slot];
      }
      const remaining: TimeInterval[] = [];
      if (blocker.startMinute > slot.startMinute) {
        remaining.push({ startMinute: slot.startMinute, endMinute: blocker.startMinute });
      }
      if (blocker.endMinute < slot.endMinute) {
        remaining.push({ startMinute: blocker.endMinute, endMinute: slot.endMinute });
      }
      return remaining;
    });
  }
  return free.sort((left, right) => left.startMinute - right.startMinute);
}

export function getRemainingStudyMinutes(day: DayPlan, nowMinute: number): number {
  return remainingAvailability(day, nowMinute).reduce(
    (total, interval) => total + interval.endMinute - interval.startMinute,
    0,
  );
}

function subtractPlacement(slots: TimeInterval[], placement: TimeInterval): TimeInterval[] {
  return slots.flatMap((slot) => {
    if (placement.endMinute <= slot.startMinute || placement.startMinute >= slot.endMinute) {
      return [slot];
    }
    const remainder: TimeInterval[] = [];
    if (placement.startMinute > slot.startMinute) {
      remainder.push({ startMinute: slot.startMinute, endMinute: placement.startMinute });
    }
    if (placement.endMinute < slot.endMinute) {
      remainder.push({ startMinute: placement.endMinute, endMinute: slot.endMinute });
    }
    return remainder;
  });
}

function findSlot(
  slots: TimeInterval[],
  durationMinutes: number,
  preferredWindow?: TimeInterval,
): TimeInterval | undefined {
  if (preferredWindow) {
    for (const slot of slots) {
      const startMinute = Math.max(slot.startMinute, preferredWindow.startMinute);
      const endMinute = Math.min(slot.endMinute, preferredWindow.endMinute);
      if (endMinute - startMinute >= durationMinutes) {
        return { startMinute, endMinute: startMinute + durationMinutes };
      }
    }
  }

  const slot = slots.find(({ startMinute, endMinute }) => endMinute - startMinute >= durationMinutes);
  return slot ? { startMinute: slot.startMinute, endMinute: slot.startMinute + durationMinutes } : undefined;
}

function comparisonFor(session: StudySession | undefined, original: StudySession | undefined) {
  if (!session) {
    return "notScheduled" as const;
  }
  if (!original) {
    return "scheduled" as const;
  }
  if (original.startMinute === session.startMinute && original.endMinute === session.endMinute) {
    return "unchanged" as const;
  }
  return "moved" as const;
}

function formatTime(minute: number): string {
  const hour = Math.floor(minute / 60) % 24;
  const displayHour = hour % 12 || 12;
  const suffix = hour < 12 ? "AM" : "PM";
  return `${displayHour}:${String(minute % 60).padStart(2, "0")} ${suffix}`;
}

function formatTimeRange(interval: TimeInterval): string {
  const start = formatTime(interval.startMinute);
  const end = formatTime(interval.endMinute);
  const startSuffix = start.slice(-2);
  const endSuffix = end.slice(-2);
  return startSuffix === endSuffix
    ? `${start.slice(0, -3)}–${end}`
    : `${start}–${end}`;
}

function movedReason(
  day: DayPlan,
  original: StudySession,
  proposed: StudySession,
): string {
  const displacedCommitment = day.commitments.find(
    (commitment) =>
      original.startMinute < commitment.endMinute &&
      original.endMinute > commitment.startMinute &&
      (proposed.startMinute >= commitment.endMinute ||
        proposed.endMinute <= commitment.startMinute),
  );
  const cause = displacedCommitment
    ? `to accommodate the fixed ${displacedCommitment.title}`
    : "to fit the remaining available study time";
  return `Moved from ${formatTimeRange(original)} to ${formatTimeRange(proposed)} ${cause}.`;
}

function unscheduledReason(task: Task, planningDate: string): Pick<TaskOutcome, "state" | "reason"> {
  if (task.deadlineDate <= planningDate) {
    return {
      state: "atRisk",
      reason: `No remaining available study window is long enough for this ${task.durationMinutes}-minute task.`,
    };
  }
  return {
    state: "notScheduledToday",
    reason: "Not scheduled today; this does not mean the future deadline is impossible.",
  };
}

export function createRecoveryProposal(day: DayPlan, nowMinute: number): RecoveryProposal {
  const slots = remainingAvailability(day, nowMinute);
  const existingByTask = new Map(day.acceptedSessions.map((session) => [session.taskId, session]));
  const incompleteTasks = day.tasks
    .filter((task) => task.status !== "completed")
    .sort(
      (left, right) =>
        left.deadlineDate.localeCompare(right.deadlineDate) ||
        PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority] ||
        left.originalOrder - right.originalOrder,
    );
  const newSessions: StudySession[] = [];
  const incompleteOutcomes: TaskOutcome[] = [];

  for (const task of incompleteTasks) {
    const placement = findSlot(slots, task.durationMinutes, task.preferredWindow);
    if (!placement) {
      const unscheduled = unscheduledReason(task, day.date);
      incompleteOutcomes.push({
        taskId: task.id,
        ...unscheduled,
        comparison: "notScheduled",
        reason: unscheduled.reason,
      });
      continue;
    }

    const session: StudySession = {
      id: `proposed-${task.id}`,
      taskId: task.id,
      ...placement,
      status: "planned",
    };
    const originalSession = existingByTask.get(task.id);
    const comparison = comparisonFor(session, originalSession);
    newSessions.push(session);
    incompleteOutcomes.push({
      taskId: task.id,
      state: "scheduled",
      comparison,
      session,
      reason: comparison === "unchanged"
        ? `Unchanged at ${formatTimeRange(session)}.`
        : comparison === "moved" && originalSession
          ? movedReason(day, originalSession, session)
          : `Scheduled at ${formatTimeRange(session)} in available study time.`,
    });
    const placementIndex = slots.findIndex(
      ({ startMinute, endMinute }) => placement.startMinute >= startMinute && placement.endMinute <= endMinute,
    );
    if (placementIndex >= 0) {
      slots.splice(placementIndex, 1, ...subtractPlacement([slots[placementIndex]!], placement));
    }
  }

  const completedSessions = day.acceptedSessions.filter(({ status }) => status === "completed");
  const completedOutcomes: TaskOutcome[] = day.tasks
    .filter(({ status }) => status === "completed")
    .map((task) => {
      const session = existingByTask.get(task.id);
      return {
        taskId: task.id,
        state: "scheduled",
        comparison: "unchanged",
        session,
        reason: session
          ? "Completed work stays at its original time and is not scheduled again."
          : "Completed work is not scheduled again.",
      };
    });

  return {
    status: "current",
    baseline: structuredClone(day),
    proposedSessions: [...completedSessions, ...newSessions].sort(
      (left, right) => left.startMinute - right.startMinute,
    ),
    outcomes: [...completedOutcomes, ...incompleteOutcomes],
    calculatedAtMinute: nowMinute,
  };
}
