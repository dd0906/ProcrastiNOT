import { describe, expect, it } from "vitest";
import { createSampleDay } from "../data/sampleDay";
import { createRecoveryProposal } from "../logic/scheduler";
import {
  archivePreviousDay,
  loadPlannerState,
  savePlannerState,
  STORAGE_KEY,
  type StorageLike,
} from "./persistence";
import type { ArchivedDay } from "../types/planner";

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("planner persistence", () => {
  it("loads the sample when no saved document exists", () => {
    const loaded = loadPlannerState(new MemoryStorage(), "2026-10-13");
    expect(loaded.state.day.date).toBe("2026-10-13");
    expect(loaded.state.day.tasks).toHaveLength(5);
    expect(loaded.notice).toBeUndefined();
  });

  it("saves and reloads the active day and proposal snapshots", () => {
    const day = createSampleDay("2026-10-13");
    const proposal = createRecoveryProposal(day, 8 * 60);
    const state = { day, proposals: [proposal], archives: [], readOnly: false };
    const storage = new MemoryStorage();

    expect(savePlannerState(storage, state)).toBeUndefined();
    const loaded = loadPlannerState(storage, "2026-10-14");

    expect(loaded.state.day).toEqual(day);
    expect(loaded.state.proposals).toEqual([proposal]);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).version).toBe(1);
  });

  it("migrates legacy in-progress tasks in active plans, proposal snapshots, and archives", () => {
    const activeDay = createSampleDay("2026-10-14");
    const activeProposal = createRecoveryProposal(activeDay, 8 * 60);
    const archivedDay = createSampleDay("2026-10-13");
    const archivedProposal = createRecoveryProposal(archivedDay, 8 * 60);
    const document = JSON.parse(JSON.stringify({
      version: 1,
      activeDay,
      proposals: [activeProposal],
      archives: [{
        id: "archive-2026-10-13",
        date: "2026-10-13",
        archivedAt: "2026-10-14T08:00:00.000Z",
        dayPlan: archivedDay,
        proposals: [archivedProposal],
      }],
    }));
    document.activeDay.tasks[1].status = "inProgress";
    document.proposals[0].baseline.tasks[2].status = "inProgress";
    document.archives[0].dayPlan.tasks[3].status = "inProgress";
    document.archives[0].proposals[0].baseline.tasks[4].status = "inProgress";
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify(document));

    const loaded = loadPlannerState(storage, "2026-10-14");

    expect(loaded.notice).toBeUndefined();
    expect(loaded.state.day.tasks[1]?.status).toBe("notStarted");
    expect(loaded.state.day.tasks[0]?.status).toBe("completed");
    expect(loaded.state.day.acceptedSessions.filter((session) => session.status === "completed"))
      .toEqual(activeDay.acceptedSessions.filter((session) => session.status === "completed"));
    expect(loaded.state.proposals[0]?.baseline.tasks[2]?.status).toBe("notStarted");
    expect(loaded.state.archives[0]?.dayPlan.tasks[3]?.status).toBe("notStarted");
    expect(loaded.state.archives[0]?.dayPlan.tasks[0]?.status).toBe("completed");
    expect(loaded.state.archives[0]?.proposals[0]?.baseline.tasks[4]?.status).toBe("notStarted");

    expect(savePlannerState(storage, loaded.state)).toBeUndefined();
    const saved = JSON.parse(storage.getItem(STORAGE_KEY)!);
    expect(saved.activeDay.tasks[1].status).toBe("notStarted");
    expect(saved.proposals[0].baseline.tasks[2].status).toBe("notStarted");
    expect(saved.archives[0].dayPlan.tasks[3].status).toBe("notStarted");
    expect(saved.archives[0].proposals[0].baseline.tasks[4].status).toBe("notStarted");
  });

  it.each(["approved", "rejected"] as const)("reloads a %s proposal status", (status) => {
    const day = createSampleDay("2026-10-13");
    const proposal = { ...createRecoveryProposal(day, 8 * 60), status };
    const storage = new MemoryStorage();
    const state = { day, proposals: [proposal], archives: [], readOnly: false };

    expect(savePlannerState(storage, state)).toBeUndefined();
    expect(loadPlannerState(storage, day.date).state.proposals[0]?.status).toBe(status);
  });

  it.each(["not-json", JSON.stringify({ version: 99 }), JSON.stringify({ version: 1, activeDay: {} })])(
    "recovers safely from malformed or unsupported saved data",
    (raw) => {
      const storage = new MemoryStorage();
      storage.setItem(STORAGE_KEY, raw);

      const loaded = loadPlannerState(storage, "2026-10-13");

      expect(loaded.state.day.date).toBe("2026-10-13");
      expect(loaded.notice).toContain("could not be read");
    },
  );

  it("rejects saved documents with malformed nested tasks instead of trusting top-level arrays", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      activeDay: {
        ...createSampleDay("2026-10-13"),
        tasks: [{ id: "broken", durationMinutes: "long" }],
      },
      proposals: [],
      archives: [],
    }));

    const loaded = loadPlannerState(storage, "2026-10-13");

    expect(loaded.state.day.tasks).toHaveLength(5);
    expect(loaded.notice).toContain("could not be read");
  });

  it("rejects duplicate task ordering values in saved data", () => {
    const day = createSampleDay("2026-10-13");
    day.tasks[1] = { ...day.tasks[1]!, originalOrder: day.tasks[0]!.originalOrder };
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      activeDay: day,
      proposals: [],
      archives: [],
    }));

    const loaded = loadPlannerState(storage, "2026-10-13");

    expect(loaded.notice).toContain("could not be read");
    expect(loaded.state.day.tasks[1]?.id).toBe("revise-networks");
  });

  it("reports storage access failures without claiming persistence", () => {
    const blocked: StorageLike = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    };
    const loaded = loadPlannerState(blocked, "2026-10-13");
    expect(loaded.notice).toContain("may not survive a refresh");
    expect(savePlannerState(blocked, loaded.state)).toContain("may not survive a refresh");
  });

  it("loads a different-date plan and its proposal history as read-only without archiving it", () => {
    const day = createSampleDay("2026-10-13");
    const proposal = createRecoveryProposal(day, 8 * 60);
    const storage = new MemoryStorage();
    const state = { day, proposals: [proposal], archives: [], readOnly: false };
    savePlannerState(storage, state);

    const loaded = loadPlannerState(storage, "2026-10-14");

    expect(loaded.state.day).toEqual(day);
    expect(loaded.state.proposals).toEqual([proposal]);
    expect(loaded.state.readOnly).toBe(true);
    expect(loaded.state.archives).toEqual([]);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).archives).toEqual([]);
  });

  it("atomically archives the complete prior day and proposal history before activating a clean sample", () => {
    const day = {
      ...createSampleDay("2026-10-13"),
      commitments: [
        ...createSampleDay("2026-10-13").commitments,
        {
          id: "surprise-lab",
          title: "Surprise lab",
          kind: "lab" as const,
          startMinute: 16 * 60,
          endMinute: 18 * 60,
          isSimulated: true,
        },
      ],
      inputRevision: 1,
    };
    const proposal = {
      ...createRecoveryProposal(day, 8 * 60),
      status: "rejected" as const,
    };
    const priorState = {
      day,
      proposals: [proposal],
      archives: [],
      readOnly: true,
    };
    const storage = new MemoryStorage();
    savePlannerState(storage, priorState);

    const result = archivePreviousDay(storage, priorState, "2026-10-14", "2026-10-14T08:00:00.000Z");

    expect(result.status).toBe("saved");
    if (result.status !== "saved") return;
    const document = JSON.parse(storage.getItem(STORAGE_KEY)!);
    const archive = document.archives[0] as ArchivedDay;
    expect(archive).toEqual({
      id: "archive-2026-10-13",
      date: "2026-10-13",
      archivedAt: "2026-10-14T08:00:00.000Z",
      dayPlan: day,
      proposals: [proposal],
    });
    expect(document.activeDay).toEqual(createSampleDay("2026-10-14"));
    expect(document.proposals).toEqual([]);
    expect(result.state.archives).toEqual([archive]);
  });

  it("does not create a duplicate archive after reloading the new active day", () => {
    const day = createSampleDay("2026-10-13");
    const storage = new MemoryStorage();
    const oldState = { day, proposals: [], archives: [], readOnly: true };
    const rollover = archivePreviousDay(storage, oldState, "2026-10-14", "2026-10-14T08:00:00.000Z");
    if (rollover.status !== "saved") throw new Error("Expected rollover persistence to succeed");

    const reloaded = loadPlannerState(storage, "2026-10-14");
    const secondConfirmation = archivePreviousDay(
      storage,
      reloaded.state,
      "2026-10-14",
      "2026-10-14T09:00:00.000Z",
    );

    expect(reloaded.state.readOnly).toBe(false);
    expect(secondConfirmation.status).toBe("same-day");
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).archives).toHaveLength(1);
  });

  it("retains the previous active day and stored document when archive persistence fails", () => {
    const day = createSampleDay("2026-10-13");
    const priorState = { day, proposals: [], archives: [], readOnly: true };
    const originalDocument = JSON.stringify({
      version: 1,
      activeDay: day,
      proposals: [],
      archives: [],
    });
    const storage: StorageLike = {
      getItem: () => originalDocument,
      setItem: () => {
        throw new Error("Storage write denied");
      },
    };

    const result = archivePreviousDay(storage, priorState, "2026-10-14", "2026-10-14T08:00:00.000Z");

    expect(result).toEqual({
      status: "failed",
      notice: "The previous day could not be archived because browser storage is unavailable. Your saved plan is still active; try again when storage is available.",
    });
    expect(priorState.day).toEqual(day);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual(JSON.parse(originalDocument));
  });
});
