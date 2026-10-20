import { describe, expect, it } from "vitest";
import type { DayPlan, Task, TimeInterval } from "../types/planner";
import { createRecoveryProposal, getRemainingStudyMinutes } from "./scheduler";

const availability: TimeInterval[] = [{ startMinute: 8 * 60, endMinute: 12 * 60 }];

function makeTask(
  id: string,
  deadlineDate: string,
  priority: Task["priority"],
  originalOrder: number,
  durationMinutes = 60,
  preferredWindow?: TimeInterval,
): Task {
  return {
    id,
    name: id,
    deadlineDate,
    priority,
    originalOrder,
    durationMinutes,
    status: "notStarted",
    preferredWindow,
  };
}

function makeDay(tasks: Task[], overrides: Partial<DayPlan> = {}): DayPlan {
  return {
    date: "2026-10-13",
    tasks,
    commitments: [],
    availabilityWindows: availability,
    protectedSleep: [],
    unavailablePeriods: [],
    acceptedSessions: [],
    inputRevision: 0,
    ...overrides,
  };
}

describe("createRecoveryProposal", () => {
  it("accounts for every task once and gives unscheduled work a reason", () => {
    const day = makeDay(
      [
        { ...makeTask("completed", "2026-10-13", "medium", 0), status: "completed" },
        makeTask("scheduled", "2026-10-13", "high", 1),
        makeTask("at-risk", "2026-10-13", "low", 2, 300),
        makeTask("future", "2026-10-18", "low", 3, 300),
      ],
      {
        acceptedSessions: [
          {
            id: "completed-session",
            taskId: "completed",
            startMinute: 7 * 60,
            endMinute: 7 * 60 + 30,
            status: "completed",
          },
        ],
      },
    );

    const outcomes = createRecoveryProposal(day, 8 * 60).outcomes;
    const outcomeIds = outcomes.map(({ taskId }) => taskId);

    expect(outcomeIds).toHaveLength(day.tasks.length);
    expect(new Set(outcomeIds).size).toBe(day.tasks.length);
    expect([...outcomeIds].sort()).toEqual(day.tasks.map(({ id }) => id).sort());
    expect(outcomes.find(({ taskId }) => taskId === "completed")?.comparison).toBe("unchanged");
    expect(outcomes.find(({ taskId }) => taskId === "completed")?.reason)
      .toBe("Completed work stays at its original time and is not scheduled again.");
    expect(outcomes.filter(({ state }) => state !== "scheduled").every(({ reason }) => reason.length > 0)).toBe(true);
  });

  it("explains a moved task using its original and proposed times and the conflicting commitment", () => {
    const day = makeDay(
      [makeTask("move-me", "2026-10-13", "high", 0, 90)],
      {
        availabilityWindows: [{ startMinute: 16 * 60, endMinute: 20 * 60 }],
        commitments: [{
          id: "surprise-lab",
          title: "surprise lab",
          kind: "lab",
          startMinute: 16 * 60,
          endMinute: 18 * 60,
          isSimulated: true,
        }],
        acceptedSessions: [{
          id: "original-session",
          taskId: "move-me",
          startMinute: 16 * 60 + 30,
          endMinute: 18 * 60,
          status: "planned",
        }],
      },
    );

    const outcome = createRecoveryProposal(day, 16 * 60).outcomes[0];

    expect(outcome?.comparison).toBe("moved");
    expect(outcome?.reason)
      .toBe("Moved from 4:30–6:00 PM to 6:00–7:30 PM to accommodate the fixed surprise lab.");
  });

  it("explains an unchanged task at its actual time", () => {
    const day = makeDay(
      [makeTask("stay-put", "2026-10-13", "high", 0, 60)],
      {
        acceptedSessions: [{
          id: "original-session",
          taskId: "stay-put",
          startMinute: 8 * 60,
          endMinute: 9 * 60,
          status: "planned",
        }],
      },
    );

    const outcome = createRecoveryProposal(day, 8 * 60).outcomes[0];

    expect(outcome?.comparison).toBe("unchanged");
    expect(outcome?.reason).toBe("Unchanged at 8:00–9:00 AM.");
  });

  it("uses deadline first, then priority, then original task order", () => {
    const day = makeDay([
      makeTask("later-high", "2026-10-14", "high", 0),
      makeTask("today-low", "2026-10-13", "low", 3),
      makeTask("today-medium", "2026-10-13", "medium", 2),
      makeTask("today-high-later-order", "2026-10-13", "high", 1),
      makeTask("today-high-first-order", "2026-10-13", "high", 0),
    ]);

    const proposal = createRecoveryProposal(day, 8 * 60);

    expect(proposal.outcomes.map(({ taskId }) => taskId)).toEqual([
      "today-high-first-order",
      "today-high-later-order",
      "today-medium",
      "today-low",
      "later-high",
    ]);
    expect(proposal.outcomes.find(({ taskId }) => taskId === "today-low")?.state).toBe("scheduled");
    expect(proposal.outcomes.find(({ taskId }) => taskId === "later-high")?.state).toBe("notScheduledToday");
  });

  it("preserves completed sessions and subtracts fixed and unavailable time", () => {
    const completed = {
      id: "done-session",
      taskId: "done",
      startMinute: 8 * 60,
      endMinute: 8 * 60 + 30,
      status: "completed" as const,
    };
    const day = makeDay(
      [
        { ...makeTask("done", "2026-10-13", "high", 0), status: "completed" },
        makeTask("work", "2026-10-13", "medium", 1, 60),
      ],
      {
        acceptedSessions: [completed],
        commitments: [
          {
            id: "meeting",
            title: "Meeting",
            kind: "class",
            startMinute: 9 * 60,
            endMinute: 10 * 60,
            isSimulated: false,
          },
        ],
        unavailablePeriods: [{ startMinute: 10 * 60 + 30, endMinute: 11 * 60 }],
      },
    );

    const proposal = createRecoveryProposal(day, 8 * 60);
    const doneOutcome = proposal.outcomes.find(({ taskId }) => taskId === "done");
    const workOutcome = proposal.outcomes.find(({ taskId }) => taskId === "work");

    expect(doneOutcome?.session).toEqual(completed);
    expect(workOutcome?.session?.startMinute).toBe(11 * 60);
    expect(workOutcome?.session?.endMinute).toBe(12 * 60);
  });

  it("tries a preferred window, then falls back to the earliest full-fit slot", () => {
    const task = makeTask("preferred", "2026-10-13", "high", 0, 60, {
      startMinute: 10 * 60,
      endMinute: 11 * 60,
    });
    const day = makeDay([task], {
      availabilityWindows: [
        { startMinute: 8 * 60, endMinute: 9 * 60 },
        { startMinute: 10 * 60, endMinute: 11 * 60 },
      ],
    });

    const proposal = createRecoveryProposal(day, 8 * 60);

    expect(proposal.outcomes[0]?.session?.startMinute).toBe(10 * 60);
  });

  it("uses the earliest full-fit slot when no complete fit exists in the preferred window", () => {
    const task = makeTask("partial-preference", "2026-10-13", "high", 0, 60, {
      startMinute: 8 * 60 + 30,
      endMinute: 10 * 60 + 30,
    });
    const day = makeDay([task], {
      availabilityWindows: [
        { startMinute: 8 * 60, endMinute: 9 * 60 },
        { startMinute: 10 * 60, endMinute: 11 * 60 },
      ],
    });

    const proposal = createRecoveryProposal(day, 8 * 60);

    expect(proposal.outcomes[0]?.session?.startMinute).toBe(8 * 60);
  });

  it("clips a partly elapsed availability window to the injected current time", () => {
    const day = makeDay([makeTask("work", "2026-10-13", "medium", 0, 60)], {
      availabilityWindows: [{ startMinute: 8 * 60, endMinute: 10 * 60 }],
    });

    const proposal = createRecoveryProposal(day, 8 * 60 + 30);

    expect(proposal.outcomes[0]?.session?.startMinute).toBe(8 * 60 + 30);
  });

  it("accepts an exact-fit slot and never shortens a task to fit", () => {
    const exactFit = createRecoveryProposal(
      makeDay([makeTask("exact", "2026-10-13", "high", 0, 60)], {
        availabilityWindows: [{ startMinute: 8 * 60, endMinute: 9 * 60 }],
      }),
      8 * 60,
    );
    const tooLong = createRecoveryProposal(
      makeDay([makeTask("too-long", "2026-10-13", "high", 0, 61)], {
        availabilityWindows: [{ startMinute: 8 * 60, endMinute: 9 * 60 }],
      }),
      8 * 60,
    );

    expect(exactFit.outcomes[0]?.session?.endMinute).toBe(9 * 60);
    expect(tooLong.outcomes[0]?.session).toBeUndefined();
  });

  it("leaves unschedulable work whole and labels risk by actual deadline", () => {
    const day = makeDay([
      makeTask("risk-today", "2026-10-13", "high", 0, 300),
      makeTask("future", "2026-10-18", "low", 1, 300),
    ]);

    const proposal = createRecoveryProposal(day, 8 * 60);

    expect(proposal.outcomes.map(({ state }) => state)).toEqual(["atRisk", "notScheduledToday"]);
    expect(proposal.outcomes.every(({ session }) => session === undefined)).toBe(true);
    expect(proposal.outcomes[0]?.reason)
      .toBe("No remaining available study window is long enough for this 300-minute task.");
    expect(proposal.outcomes[1]?.reason).toContain("Not scheduled today");
  });

  it("returns the same placements and explanations for identical inputs", () => {
    const day = makeDay([
      makeTask("first", "2026-10-13", "high", 0),
      makeTask("second", "2026-10-14", "medium", 1),
    ]);

    expect(createRecoveryProposal(day, 8 * 60)).toEqual(createRecoveryProposal(day, 8 * 60));
  });
});

describe("getRemainingStudyMinutes", () => {
  it("counts remaining window capacity after blockers without counting elapsed or duplicate time", () => {
    const day = makeDay(
      [
        makeTask("planned-work", "2026-10-13", "medium", 0, 30),
        { ...makeTask("completed-work", "2026-10-13", "medium", 1), status: "completed" },
      ],
      {
        availabilityWindows: [
          { startMinute: 8 * 60, endMinute: 10 * 60 },
          { startMinute: 9 * 60, endMinute: 12 * 60 },
        ],
        commitments: [
          {
            id: "meeting",
            title: "Meeting",
            kind: "class",
            startMinute: 9 * 60 + 30,
            endMinute: 10 * 60,
            isSimulated: false,
          },
        ],
        protectedSleep: [{ startMinute: 10 * 60 + 15, endMinute: 10 * 60 + 30 }],
        unavailablePeriods: [{ startMinute: 11 * 60, endMinute: 11 * 60 + 30 }],
        acceptedSessions: [
          {
            id: "completed-session",
            taskId: "completed-work",
            startMinute: 10 * 60,
            endMinute: 10 * 60 + 15,
            status: "completed",
          },
          {
            id: "planned-session",
            taskId: "planned-work",
            startMinute: 10 * 60 + 30,
            endMinute: 11 * 60,
            status: "planned",
          },
        ],
      },
    );

    expect(getRemainingStudyMinutes(day, 9 * 60)).toBe(90);
    expect(getRemainingStudyMinutes(day, 12 * 60)).toBe(0);
  });
});
