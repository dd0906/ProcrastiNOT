import { describe, expect, it } from "vitest";
import { createSampleDay } from "../data/sampleDay";
import { createRecoveryProposal } from "../logic/scheduler";
import { plannerReducer, type PlannerState } from "./plannerReducer";
import type { DayPlan } from "../types/planner";

function withSurpriseLab(day: DayPlan): DayPlan {
  return {
    ...day,
    commitments: [
      ...day.commitments,
      {
        id: "surprise-lab",
        title: "Surprise lab",
        kind: "lab" as const,
        startMinute: 16 * 60,
        endMinute: 18 * 60,
        isSimulated: true,
      },
    ],
    inputRevision: day.inputRevision + 1,
  };
}

function stateWithProposal(): PlannerState {
  const day = withSurpriseLab(createSampleDay("2026-10-13"));
  return {
    day,
    proposals: [createRecoveryProposal(day, 7 * 60)],
    archives: [],
    readOnly: false,
  };
}

describe("plannerReducer saved edits", () => {
  it("marks a proposal outdated while preserving its snapshot and placements", () => {
    const day = createSampleDay("2026-10-13");
    const proposal = createRecoveryProposal(day, 8 * 60);
    const initial: PlannerState = { day, proposals: [proposal], archives: [], readOnly: false };
    const changedTask = { ...day.tasks[1]!, name: "Updated task name" };

    const result = plannerReducer(initial, { type: "task/saved", task: changedTask });

    expect(result.day.inputRevision).toBe(1);
    expect(result.proposals[0]?.status).toBe("outdated");
    expect(result.proposals[0]?.baseline).toEqual(proposal.baseline);
    expect(result.proposals[0]?.proposedSessions).toEqual(proposal.proposedSessions);
    expect(result.proposals[0]?.outcomes).toEqual(proposal.outcomes);
  });

  it("adds and edits a commitment as a saved input and invalidates a current proposal", () => {
    const day = createSampleDay("2026-10-13");
    const proposal = createRecoveryProposal(day, 8 * 60);
    const initial: PlannerState = { day, proposals: [proposal], archives: [], readOnly: false };
    const commitment = {
      id: "tutorial",
      title: "Tutorial",
      kind: "other" as const,
      startMinute: 11 * 60,
      endMinute: 12 * 60,
      isSimulated: false,
    };

    const added = plannerReducer(initial, { type: "commitment/saved", commitment });
    const edited = plannerReducer(added, {
      type: "commitment/saved",
      commitment: { ...commitment, title: "Lab tutorial" },
    });

    expect(added.day.commitments).toContainEqual(commitment);
    expect(added.proposals[0]?.status).toBe("outdated");
    expect(edited.day.commitments.find(({ id }) => id === commitment.id)?.title).toBe("Lab tutorial");
    expect(edited.day.inputRevision).toBe(2);
  });

  it("applies a current proposal atomically and preserves fixed and completed work", () => {
    const initial = stateWithProposal();
    const completed = initial.day.acceptedSessions.filter(({ status }) => status === "completed");
    const commitments = initial.day.commitments;
    const proposal = initial.proposals[0]!;

    const result = plannerReducer(initial, {
      type: "proposal/approved",
      nowMinute: proposal.calculatedAtMinute,
    });

    expect(result.proposals[0]?.status).toBe("approved");
    expect(result.day.commitments).toEqual(commitments);
    expect(result.day.acceptedSessions.filter(({ status }) => status === "completed")).toEqual(completed);
    expect(result.day.acceptedSessions.filter(({ status }) => status === "planned")).toEqual(
      proposal.proposedSessions.filter(({ status }) => status === "planned"),
    );
  });

  it("rejects a proposal after its first suggested start time has passed without changing the schedule", () => {
    const initial = stateWithProposal();
    const proposal = initial.proposals[0]!;
    const firstProposedStart = Math.min(
      ...proposal.proposedSessions
        .filter(({ status }) => status === "planned")
        .map(({ startMinute }) => startMinute),
    );
    const acceptedSessions = initial.day.acceptedSessions;

    const result = plannerReducer(initial, {
      type: "proposal/approved",
      nowMinute: firstProposedStart + 1,
    });

    expect(result.day.acceptedSessions).toEqual(acceptedSessions);
    expect(result.proposals[0]?.status).toBe("outdated");
    expect(result.proposals[0]?.outdatedReason).toBe(
      "This plan contains a study session whose start time has already passed. Generate an updated plan to continue.",
    );
  });

  it("does not apply a proposal based on an older input revision", () => {
    const initial = stateWithProposal();
    const acceptedSessions = initial.day.acceptedSessions;
    const changed = {
      ...initial,
      day: { ...initial.day, inputRevision: initial.day.inputRevision + 1 },
    };

    const result = plannerReducer(changed, { type: "proposal/approved", nowMinute: 7 * 60 });

    expect(result.day.acceptedSessions).toEqual(acceptedSessions);
    expect(result.proposals[0]?.status).toBe("outdated");
    expect(result.proposals[0]?.baseline.acceptedSessions).toEqual(acceptedSessions);
  });

  it("rejects without moving sessions or removing the fixed lab", () => {
    const initial = stateWithProposal();
    const acceptedSessions = initial.day.acceptedSessions;
    const commitments = initial.day.commitments;

    const result = plannerReducer(initial, { type: "proposal/rejected" });

    expect(result.day.acceptedSessions).toEqual(acceptedSessions);
    expect(result.day.commitments).toEqual(commitments);
    expect(result.day.commitments.find(({ isSimulated }) => isSimulated)).toMatchObject({
      startMinute: 16 * 60,
      endMinute: 18 * 60,
    });
    expect(result.proposals[0]?.status).toBe("rejected");
  });

  it("resets the active day to a clean sample and removes proposal history", () => {
    const initial = stateWithProposal();

    const result = plannerReducer(initial, { type: "day/reset", date: "2026-10-13" });

    expect(result.day).toEqual(createSampleDay("2026-10-13"));
    expect(result.proposals).toEqual([]);
    expect(result.archives).toEqual([]);
    expect(result.readOnly).toBe(false);
    expect(result.notice).toBeUndefined();
  });

  it("blocks edits, scheduling, decisions, and same-day reset while a prior day is read-only", () => {
    const initial = { ...stateWithProposal(), readOnly: true };
    const task = { ...initial.day.tasks[0]!, name: "Changed while read-only" };
    const commitment = {
      id: "new-commitment",
      title: "New commitment",
      kind: "other" as const,
      startMinute: 11 * 60,
      endMinute: 12 * 60,
      isSimulated: false,
    };
    const actions = [
      { type: "proposal/generated" as const, proposal: initial.proposals[0]! },
      { type: "proposal/approved" as const, nowMinute: 7 * 60 },
      { type: "proposal/rejected" as const },
      { type: "day/reset" as const, date: "2026-10-14" },
      { type: "task/saved" as const, task },
      { type: "commitment/saved" as const, commitment },
    ];

    for (const action of actions) {
      expect(plannerReducer(initial, action)).toBe(initial);
    }
  });

  it("changes read-only access only when the checked local date differs from the plan date", () => {
    const initial = stateWithProposal();

    const priorDay = plannerReducer(initial, { type: "day/date-checked", today: "2026-10-14" });
    const sameDay = plannerReducer(priorDay, { type: "day/date-checked", today: "2026-10-13" });

    expect(priorDay.readOnly).toBe(true);
    expect(sameDay.readOnly).toBe(false);
  });
});
