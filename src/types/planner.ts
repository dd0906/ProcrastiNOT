export type Priority = "high" | "medium" | "low";
export type TaskStatus = "notStarted" | "completed";
export type SessionStatus = "planned" | "completed";

export interface TimeInterval {
  startMinute: number;
  endMinute: number;
}

export interface Task {
  id: string;
  name: string;
  durationMinutes: number;
  deadlineDate: string;
  priority: Priority;
  status: TaskStatus;
  preferredWindow?: TimeInterval;
  originalOrder: number;
}

export interface FixedCommitment extends TimeInterval {
  id: string;
  title: string;
  kind: "class" | "lab" | "other";
  isSimulated: boolean;
}

export interface StudySession extends TimeInterval {
  id: string;
  taskId: string;
  status: SessionStatus;
}

export interface DayPlan {
  date: string;
  tasks: Task[];
  commitments: FixedCommitment[];
  availabilityWindows: TimeInterval[];
  protectedSleep: TimeInterval[];
  unavailablePeriods: TimeInterval[];
  acceptedSessions: StudySession[];
  inputRevision: number;
}

export type TaskOutcomeState = "scheduled" | "atRisk" | "notScheduledToday";
export type Comparison = "unchanged" | "moved" | "scheduled" | "notScheduled";

export interface TaskOutcome {
  taskId: string;
  state: TaskOutcomeState;
  comparison: Comparison;
  session?: StudySession;
  reason: string;
}

export interface RecoveryProposal {
  status: "current" | "outdated" | "approved" | "rejected";
  baseline: DayPlan;
  proposedSessions: StudySession[];
  outcomes: TaskOutcome[];
  calculatedAtMinute: number;
  outdatedReason?: string;
}

export interface ArchivedDay {
  id: string;
  date: string;
  archivedAt: string;
  dayPlan: DayPlan;
  proposals: RecoveryProposal[];
}
