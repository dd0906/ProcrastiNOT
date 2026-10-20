import type { FixedCommitment, Priority, Task, TaskStatus, TimeInterval } from "../types/planner";

export interface TaskInput {
  name: string;
  durationMinutes: string;
  deadlineDate: string;
  priority: string;
  status: string;
  preferredStart: string;
  preferredEnd: string;
}

export interface CommitmentInput {
  title: string;
  start: string;
  end: string;
  kind: string;
}

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

export type TaskField =
  | "name"
  | "durationMinutes"
  | "deadlineDate"
  | "priority"
  | "status"
  | "preferredWindow";

export type CommitmentField = "title" | "start" | "end" | "kind";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const PRIORITIES = new Set<Priority>(["high", "medium", "low"]);
const STATUSES = new Set<TaskStatus>(["notStarted", "completed"]);
const COMMITMENT_KINDS = new Set<FixedCommitment["kind"]>(["class", "lab", "other"]);

function isPriority(value: string): value is Priority {
  return PRIORITIES.has(value as Priority);
}

function isTaskStatus(value: string): value is TaskStatus {
  return STATUSES.has(value as TaskStatus);
}

function isCommitmentKind(value: string): value is FixedCommitment["kind"] {
  return COMMITMENT_KINDS.has(value as FixedCommitment["kind"]);
}

export function parseLocalDate(date: string): boolean {
  if (!DATE_PATTERN.test(date)) return false;
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

function parseTime(value: string): number | undefined {
  const match = TIME_PATTERN.exec(value);
  if (!match) return undefined;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function validateTaskInput(input: TaskInput): FieldErrors<TaskField> {
  const errors: FieldErrors<TaskField> = {};
  if (!input.name.trim()) {
    errors.name = "Please enter a task name.";
  }

  const duration = Number(input.durationMinutes);
  if (
    input.durationMinutes.trim() === "" ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > 480
  ) {
    errors.durationMinutes = "Duration must be between 1 and 480 minutes.";
  }

  if (!parseLocalDate(input.deadlineDate)) {
    errors.deadlineDate = "Please enter a valid deadline.";
  }

  if (!isPriority(input.priority)) {
    errors.priority = "Choose High, Medium, or Low priority.";
  }

  if (!isTaskStatus(input.status)) {
    errors.status = "Choose a valid completion status.";
  }

  if (input.preferredStart || input.preferredEnd) {
    const start = parseTime(input.preferredStart);
    const end = parseTime(input.preferredEnd);
    if (start === undefined || end === undefined || end <= start) {
      errors.preferredWindow = "Preferred end time must be later than its start.";
    }
  }
  return errors;
}

export function buildTask(
  input: TaskInput,
  id: string,
  originalOrder: number,
): Task {
  const errors = validateTaskInput(input);
  if (Object.keys(errors).length > 0) {
    throw new TypeError("Cannot build a task from invalid input.");
  }
  if (!isPriority(input.priority) || !isTaskStatus(input.status)) {
    throw new TypeError("Cannot build a task from invalid input.");
  }
  const preferredStart = input.preferredStart ? parseTime(input.preferredStart) : undefined;
  const preferredEnd = input.preferredEnd ? parseTime(input.preferredEnd) : undefined;
  const preferredWindow: TimeInterval | undefined =
    preferredStart !== undefined && preferredEnd !== undefined
      ? { startMinute: preferredStart, endMinute: preferredEnd }
      : undefined;
  return {
    id,
    name: input.name.trim(),
    durationMinutes: Number(input.durationMinutes),
    deadlineDate: input.deadlineDate,
    priority: input.priority,
    status: input.status,
    preferredWindow,
    originalOrder,
  };
}

export function taskToInput(task?: Task): TaskInput {
  return {
    name: task?.name ?? "",
    durationMinutes: task ? String(task.durationMinutes) : "",
    deadlineDate: task?.deadlineDate ?? "",
    priority: task?.priority ?? "medium",
    status: task?.status ?? "notStarted",
    preferredStart: task?.preferredWindow ? formatInputTime(task.preferredWindow.startMinute) : "",
    preferredEnd: task?.preferredWindow ? formatInputTime(task.preferredWindow.endMinute) : "",
  };
}

function formatInputTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function validateCommitmentInput(input: CommitmentInput): FieldErrors<CommitmentField> {
  const errors: FieldErrors<CommitmentField> = {};
  const start = parseTime(input.start);
  const end = parseTime(input.end);
  if (!input.title.trim()) errors.title = "Please enter a commitment name.";
  if (start === undefined) errors.start = "Enter a valid start time.";
  if (end === undefined) errors.end = "Enter a valid end time.";
  if (start !== undefined && end !== undefined && end <= start) {
    errors.end = "End time must be later than start time.";
  }
  if (!isCommitmentKind(input.kind)) {
    errors.kind = "Choose a valid commitment type.";
  }
  return errors;
}

export function buildCommitment(
  input: CommitmentInput,
  id: string,
  existing?: FixedCommitment,
): FixedCommitment {
  const errors = validateCommitmentInput(input);
  if (Object.keys(errors).length > 0) {
    throw new TypeError("Cannot build a commitment from invalid input.");
  }
  const startMinute = parseTime(input.start);
  const endMinute = parseTime(input.end);
  if (startMinute === undefined || endMinute === undefined || !isCommitmentKind(input.kind)) {
    throw new TypeError("Cannot build a commitment from invalid input.");
  }
  return {
    id,
    title: input.title.trim(),
    startMinute,
    endMinute,
    kind: input.kind,
    isSimulated: existing?.isSimulated ?? false,
  };
}

export function commitmentToInput(commitment?: FixedCommitment): CommitmentInput {
  return {
    title: commitment?.title ?? "",
    start: commitment ? formatInputTime(commitment.startMinute) : "",
    end: commitment ? formatInputTime(commitment.endMinute) : "",
    kind: commitment?.kind ?? "other",
  };
}
