import type {
  DayPlan,
  FixedCommitment,
  RecoveryProposal,
  Task,
  ArchivedDay,
} from "../types/planner";
import { createSampleDay } from "../data/sampleDay";

export interface PlannerState {
  day: DayPlan;
  proposals: RecoveryProposal[];
  archives: ArchivedDay[];
  readOnly: boolean;
  notice?: string;
}

export type PlannerAction =
  | { type: "proposal/generated"; proposal: RecoveryProposal }
  | { type: "proposal/approved"; nowMinute: number }
  | { type: "proposal/rejected" }
  | { type: "day/reset"; date: string }
  | { type: "day/date-checked"; today: string }
  | { type: "day/rollover-started"; today: string; archives: ArchivedDay[] }
  | { type: "task/saved"; task: Task }
  | { type: "commitment/saved"; commitment: FixedCommitment }
  | { type: "persistence/notice"; notice: string | undefined };

export function plannerReducer(state: PlannerState, action: PlannerAction): PlannerState {
  if (
    state.readOnly &&
    action.type !== "day/date-checked" &&
    action.type !== "day/rollover-started" &&
    action.type !== "persistence/notice"
  ) {
    return state;
  }

  switch (action.type) {
    case "proposal/generated":
      return { ...state, proposals: [...state.proposals, action.proposal], notice: undefined };
    case "proposal/approved": {
      const index = state.proposals.length - 1;
      const proposal = state.proposals[index];
      if (!proposal || proposal.status !== "current") return state;
      if (proposal.baseline.inputRevision !== state.day.inputRevision) {
        return updateLatestProposal(state, {
          ...proposal,
          status: "outdated",
          outdatedReason: "This plan was created from older task or commitment data. Generate an updated plan before applying changes.",
        });
      }
      if (
        proposal.proposedSessions.some(
          (session) => session.status === "planned" && session.startMinute < action.nowMinute,
        )
      ) {
        return updateLatestProposal(state, {
          ...proposal,
          status: "outdated",
          outdatedReason: "This plan contains a study session whose start time has already passed. Generate an updated plan to continue.",
        });
      }
      const completedSessions = state.day.acceptedSessions.filter(
        (session) => session.status === "completed",
      );
      const proposedSessions = proposal.proposedSessions.filter(
        (session) => session.status === "planned",
      );
      return {
        ...state,
        day: {
          ...state.day,
          acceptedSessions: [...completedSessions, ...proposedSessions].sort(
            (left, right) => left.startMinute - right.startMinute,
          ),
        },
        proposals: state.proposals.map((item, itemIndex) =>
          itemIndex === index ? { ...item, status: "approved" } : item,
        ),
        notice: undefined,
      };
    }
    case "proposal/rejected": {
      const index = state.proposals.length - 1;
      const proposal = state.proposals[index];
      if (!proposal || proposal.status !== "current") return state;
      if (proposal.baseline.inputRevision !== state.day.inputRevision) {
        return updateLatestProposal(state, {
          ...proposal,
          status: "outdated",
          outdatedReason: "This plan was created from older task or commitment data. Generate an updated plan before applying changes.",
        });
      }
      return {
        ...state,
        proposals: state.proposals.map((item, itemIndex) =>
          itemIndex === index ? { ...item, status: "rejected" } : item,
        ),
        notice: undefined,
      };
    }
    case "day/reset":
      return {
        ...state,
        day: createSampleDay(action.date),
        proposals: [],
        readOnly: false,
        notice: undefined,
      };
    case "day/date-checked": {
      const readOnly = state.day.date !== action.today;
      return readOnly === state.readOnly ? state : { ...state, readOnly };
    }
    case "day/rollover-started":
      return {
        day: createSampleDay(action.today),
        proposals: [],
        archives: action.archives,
        readOnly: false,
      };
    case "task/saved": {
      const exists = state.day.tasks.some(({ id }) => id === action.task.id);
      const tasks = exists
        ? state.day.tasks.map((task) => (task.id === action.task.id ? action.task : task))
        : [...state.day.tasks, action.task];
      return {
        ...state,
        day: { ...state.day, tasks, inputRevision: state.day.inputRevision + 1 },
        proposals: invalidateCurrentProposal(state.proposals),
      };
    }
    case "commitment/saved": {
      const exists = state.day.commitments.some(({ id }) => id === action.commitment.id);
      const commitments = exists
        ? state.day.commitments.map((item) => (item.id === action.commitment.id ? action.commitment : item))
        : [...state.day.commitments, action.commitment];
      return {
        ...state,
        day: { ...state.day, commitments, inputRevision: state.day.inputRevision + 1 },
        proposals: invalidateCurrentProposal(state.proposals),
      };
    }
    case "persistence/notice":
      return { ...state, notice: action.notice };
  }
}

function updateLatestProposal(state: PlannerState, proposal: RecoveryProposal): PlannerState {
  const index = state.proposals.length - 1;
  return {
    ...state,
    proposals: state.proposals.map((item, itemIndex) => itemIndex === index ? proposal : item),
    notice: undefined,
  };
}

function invalidateCurrentProposal(proposals: RecoveryProposal[]): RecoveryProposal[] {
  return proposals.map((proposal) =>
    proposal.status === "current"
      ? {
          ...proposal,
          status: "outdated",
          outdatedReason:
            "Your tasks have changed since this recovery plan was created. Review an updated plan before applying changes.",
        }
      : proposal,
  );
}
