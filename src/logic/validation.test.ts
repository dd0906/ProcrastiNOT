import { describe, expect, it } from "vitest";
import {
  buildTask,
  taskToInput,
  validateCommitmentInput,
  validateTaskInput,
} from "./validation";

const validTask = {
  name: "  Read notes  ",
  durationMinutes: "60",
  deadlineDate: "2026-10-13",
  priority: "medium",
  status: "notStarted",
  preferredStart: "",
  preferredEnd: "",
};

describe("validateTaskInput", () => {
  it("uses the exact required name, duration, and deadline errors", () => {
    expect(validateTaskInput({ ...validTask, name: "  " }).name).toBe("Please enter a task name.");
    for (const durationMinutes of ["", "0", "-1", "abc", "481"]) {
      expect(validateTaskInput({ ...validTask, durationMinutes }).durationMinutes).toBe(
        "Duration must be between 1 and 480 minutes.",
      );
    }
    for (const deadlineDate of ["", "2026-02-30", "not-a-date"]) {
      expect(validateTaskInput({ ...validTask, deadlineDate }).deadlineDate).toBe(
        "Please enter a valid deadline.",
      );
    }
  });

  it("accepts boundary durations, trims valid names, and preserves optional preference", () => {
    expect(validateTaskInput({ ...validTask, durationMinutes: "0.5" })).toEqual({});
    expect(validateTaskInput({ ...validTask, durationMinutes: "480" })).toEqual({});
    const task = buildTask(
      {
        ...validTask,
        durationMinutes: "480",
        preferredStart: "09:00",
        preferredEnd: "10:30",
      },
      "task-1",
      4,
    );

    expect(task.name).toBe("Read notes");
    expect(task.originalOrder).toBe(4);
    expect(task.preferredWindow).toEqual({ startMinute: 540, endMinute: 630 });
    expect(taskToInput(task).preferredEnd).toBe("10:30");
  });

  it("accepts past deadlines but rejects malformed or reversed preferred times", () => {
    expect(validateTaskInput({ ...validTask, deadlineDate: "2026-10-12" })).toEqual({});
    expect(
      validateTaskInput({ ...validTask, preferredStart: "10:30", preferredEnd: "10:30" })
        .preferredWindow,
    ).toBe("Preferred end time must be later than its start.");
  });

  it("requires supported priority and status values", () => {
    expect(validateTaskInput({ ...validTask, priority: "urgent" }).priority).toBeTruthy();
    expect(validateTaskInput({ ...validTask, status: "done" }).status).toBeTruthy();
    expect(validateTaskInput({ ...validTask, status: "inProgress" }).status).toBeTruthy();
    expect(validateTaskInput({ ...validTask, status: "notStarted" })).toEqual({});
    expect(validateTaskInput({ ...validTask, status: "completed" })).toEqual({});
  });
});

describe("validateCommitmentInput", () => {
  it("requires a label and a valid increasing same-day time range", () => {
    expect(
      validateCommitmentInput({ title: " ", start: "09:00", end: "10:00", kind: "class" }).title,
    ).toBe("Please enter a commitment name.");
    expect(
      validateCommitmentInput({ title: "Seminar", start: "10:00", end: "10:00", kind: "class" }).end,
    ).toBe("End time must be later than start time.");
  });

  it("accepts a valid fixed commitment", () => {
    expect(
      validateCommitmentInput({ title: "Seminar", start: "09:00", end: "10:00", kind: "class" }),
    ).toEqual({});
  });
});
