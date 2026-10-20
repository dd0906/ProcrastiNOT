import { createSampleDay } from "../data/sampleDay";
import { parseLocalDate } from "../logic/validation";
import type {
  DayPlan,
  FixedCommitment,
  RecoveryProposal,
  ArchivedDay,
  StudySession,
  Task,
  TaskOutcome,
  TimeInterval,
} from "../types/planner";
import type { PlannerState } from "../state/plannerReducer";

export const STORAGE_KEY = "procrastinot:v1";
const SCHEMA_VERSION = 1;

export interface PersistedPlannerDocument {
  version: number;
  activeDay: DayPlan;
  proposals: RecoveryProposal[];
  archives: ArchivedDay[];
}

export interface LoadResult {
  state: PlannerState;
  notice?: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInterval(value: unknown): value is TimeInterval {
  return (
    isRecord(value) &&
    Number.isInteger(value.startMinute) &&
    Number(value.startMinute) >= 0 &&
    Number.isInteger(value.endMinute) &&
    Number(value.endMinute) <= 24 * 60 &&
    Number(value.endMinute) > Number(value.startMinute)
  );
}

function isTask(value: unknown): value is Task {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    typeof value.durationMinutes === "number" &&
    Number.isFinite(value.durationMinutes) &&
    value.durationMinutes > 0 &&
    value.durationMinutes <= 480 &&
    typeof value.deadlineDate === "string" &&
    parseLocalDate(value.deadlineDate) &&
    (value.priority === "high" || value.priority === "medium" || value.priority === "low") &&
    (value.status === "notStarted" || value.status === "completed") &&
    (value.preferredWindow === undefined || isInterval(value.preferredWindow)) &&
    Number.isInteger(value.originalOrder) &&
    Number(value.originalOrder) >= 0
  );
}

function isCommitment(value: unknown): value is FixedCommitment {
  return (
    isRecord(value) &&
    isInterval(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    (value.kind === "class" || value.kind === "lab" || value.kind === "other") &&
    typeof value.isSimulated === "boolean"
  );
}

function isSession(value: unknown): value is StudySession {
  return (
    isRecord(value) &&
    isInterval(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.taskId === "string" &&
    value.taskId.length > 0 &&
    (value.status === "planned" || value.status === "completed")
  );
}

function isDayPlan(value: unknown): value is DayPlan {
  if (!isRecord(value)) return false;
  const validShape =
    typeof value.date === "string" &&
    parseLocalDate(value.date) &&
    Array.isArray(value.tasks) &&
    value.tasks.every(isTask) &&
    Array.isArray(value.commitments) &&
    value.commitments.every(isCommitment) &&
    Array.isArray(value.availabilityWindows) &&
    value.availabilityWindows.every(isInterval) &&
    Array.isArray(value.protectedSleep) &&
    value.protectedSleep.every(isInterval) &&
    Array.isArray(value.unavailablePeriods) &&
    value.unavailablePeriods.every(isInterval) &&
    Array.isArray(value.acceptedSessions) &&
    value.acceptedSessions.every(isSession) &&
    Number.isInteger(value.inputRevision) &&
    Number(value.inputRevision) >= 0;
  if (!validShape) return false;
  if (!Array.isArray(value.tasks) || !Array.isArray(value.acceptedSessions)) return false;
  const tasks = value.tasks.filter(isTask);
  const acceptedSessions = value.acceptedSessions.filter(isSession);
  if (tasks.length !== value.tasks.length || acceptedSessions.length !== value.acceptedSessions.length) {
    return false;
  }
  const taskIds = new Set(tasks.map((task) => task.id));
  const originalOrders = new Set(tasks.map((task) => task.originalOrder));
  return (
    taskIds.size === tasks.length &&
    originalOrders.size === tasks.length &&
    acceptedSessions.every((session) => taskIds.has(session.taskId))
  );
}

function isOutcome(value: unknown): value is TaskOutcome {
  return (
    isRecord(value) &&
    typeof value.taskId === "string" &&
    value.taskId.length > 0 &&
    (value.state === "scheduled" || value.state === "atRisk" || value.state === "notScheduledToday") &&
    (value.comparison === "unchanged" ||
      value.comparison === "moved" ||
      value.comparison === "scheduled" ||
      value.comparison === "notScheduled") &&
    (value.session === undefined || isSession(value.session)) &&
    typeof value.reason === "string"
  );
}

function isProposal(value: unknown): value is RecoveryProposal {
  if (!isRecord(value)) return false;
  return (
    (value.status === "current" ||
      value.status === "outdated" ||
      value.status === "approved" ||
      value.status === "rejected") &&
    isDayPlan(value.baseline) &&
    Array.isArray(value.proposedSessions) &&
    value.proposedSessions.every(isSession) &&
    Array.isArray(value.outcomes) &&
    value.outcomes.every(isOutcome) &&
    Number.isInteger(value.calculatedAtMinute) &&
    Number(value.calculatedAtMinute) >= 0 &&
    Number(value.calculatedAtMinute) < 24 * 60 &&
    (value.outdatedReason === undefined || typeof value.outdatedReason === "string")
  );
}

function isArchivedDay(value: unknown): value is ArchivedDay {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.date === "string" &&
    parseLocalDate(value.date) !== undefined &&
    typeof value.archivedAt === "string" &&
    Number.isFinite(Date.parse(value.archivedAt)) &&
    isDayPlan(value.dayPlan) &&
    value.dayPlan.date === value.date &&
    Array.isArray(value.proposals) &&
    value.proposals.every(isProposal)
  );
}

function migrateLegacyTaskStatusesInDay(value: unknown): void {
  if (!isRecord(value) || !Array.isArray(value.tasks)) return;
  for (const task of value.tasks) {
    if (isRecord(task) && task.status === "inProgress") {
      task.status = "notStarted";
    }
  }
}

function migrateLegacyTaskStatusesInProposals(value: unknown): void {
  if (!Array.isArray(value)) return;
  for (const proposal of value) {
    if (isRecord(proposal)) migrateLegacyTaskStatusesInDay(proposal.baseline);
  }
}

function migrateLegacyTaskStatuses(document: Record<string, unknown>): void {
  migrateLegacyTaskStatusesInDay(document.activeDay);
  migrateLegacyTaskStatusesInProposals(document.proposals);
  if (!Array.isArray(document.archives)) return;
  for (const archive of document.archives) {
    if (!isRecord(archive)) continue;
    migrateLegacyTaskStatusesInDay(archive.dayPlan);
    migrateLegacyTaskStatusesInProposals(archive.proposals);
  }
}

function parseDocument(raw: string): PersistedPlannerDocument | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed) || parsed.version !== SCHEMA_VERSION) return undefined;
  migrateLegacyTaskStatuses(parsed);
  if (!isDayPlan(parsed.activeDay)) return undefined;
  if (!Array.isArray(parsed.proposals) || !parsed.proposals.every(isProposal)) return undefined;
  if (!Array.isArray(parsed.archives) || !parsed.archives.every(isArchivedDay)) return undefined;
  const archiveDates = parsed.archives.map((archive) => archive.date);
  if (new Set(archiveDates).size !== archiveDates.length) return undefined;
  return {
    version: SCHEMA_VERSION,
    activeDay: parsed.activeDay,
    proposals: parsed.proposals,
    archives: parsed.archives,
  };
}

export function createDocument(state: PlannerState): PersistedPlannerDocument {
  return {
    version: SCHEMA_VERSION,
    activeDay: state.day,
    proposals: state.proposals,
    archives: state.archives,
  };
}

export function loadPlannerState(storage: StorageLike, today: string): LoadResult {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) {
      return {
        state: {
          day: createSampleDay(today),
          proposals: [],
          archives: [],
          readOnly: false,
        },
      };
    }
    const document = parseDocument(raw);
    if (!document) {
      return {
        state: {
          day: createSampleDay(today),
          proposals: [],
          archives: [],
          readOnly: false,
        },
        notice: "Saved planner data could not be read. A fresh sample day is ready.",
      };
    }
    return {
      state: {
        day: document.activeDay,
        proposals: document.proposals,
        archives: document.archives,
        readOnly: document.activeDay.date !== today,
      },
    };
  } catch {
    return {
      state: {
        day: createSampleDay(today),
        proposals: [],
        archives: [],
        readOnly: false,
      },
      notice: "Browser storage is unavailable. Your changes may not survive a refresh.",
    };
  }
}

export function savePlannerState(storage: StorageLike, state: PlannerState): string | undefined {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(createDocument(state)));
    return undefined;
  } catch {
    return "Browser storage is unavailable. Your changes may not survive a refresh.";
  }
}

export type RolloverResult =
  | { status: "same-day"; state: PlannerState }
  | { status: "saved"; state: PlannerState }
  | { status: "failed"; notice: string };

export const ROLLOVER_FAILURE_NOTICE =
  "The previous day could not be archived because browser storage is unavailable. Your saved plan is still active; try again when storage is available.";

export function archivePreviousDay(
  storage: StorageLike,
  state: PlannerState,
  today: string,
  archivedAt: string,
): RolloverResult {
  if (state.day.date === today) return { status: "same-day", state };

  const archives = state.archives.some((archive) => archive.date === state.day.date)
    ? state.archives
    : [
        ...state.archives,
        {
          id: `archive-${state.day.date}`,
          date: state.day.date,
          archivedAt,
          dayPlan: state.day,
          proposals: state.proposals,
        },
      ];
  const nextState: PlannerState = {
    day: createSampleDay(today),
    proposals: [],
    archives,
    readOnly: false,
  };

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(createDocument(nextState)));
  } catch {
    return { status: "failed", notice: ROLLOVER_FAILURE_NOTICE };
  }

  return { status: "saved", state: nextState };
}
