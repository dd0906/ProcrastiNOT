import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSampleDay } from "./data/sampleDay";
import { createRecoveryProposal } from "./logic/scheduler";
import App from "./App";

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 13, 21, 56));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function confirmSurpriseLab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Add surprise lab" }));
  await user.click(screen.getByRole("button", { name: "Add lab and create proposal" }));
}

describe("sample-day recovery flow", () => {
  it("shows the prepared header logo and static welcome mascot artwork", () => {
    render(<App />);

    expect(screen.getByRole("img", { name: "ProcrastiNOT ghost mascot and wordmark" }))
      .toHaveAttribute("src", "/assets/procrastinot-header-logo.png");
    expect(screen.getByRole("img", { name: "ProcrastiNOT ghost mascot holding a notebook and pen" }))
      .toHaveAttribute("src", "/assets/procrastinot-primary-mascot.png");
  });

  it("shows Jumpclip beside task actions and Hedgehog only while planning a task", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("img", { name: "Jumpclip, the quick-action helper" }))
      .toHaveAttribute("src", "/assets/procrastinot-jumpclip-mascot.png");
    expect(screen.queryByRole("img", { name: "Hedgehog, the thoughtful planner" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Cloudy/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add task" }));

    expect(screen.getByRole("img", { name: "Hedgehog, the thoughtful planner" }))
      .toHaveAttribute("src", "/assets/procrastinot-hedgehog-mascot.png");
    expect(screen.getByText(/breaking a task into smaller steps is not available yet/i)).toBeInTheDocument();
  });

  it("does not archive or restrict a same-day reload", () => {
    render(<App />);

    expect(screen.queryByText("This plan belongs to a different day. Your saved work is preserved.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset sample day" })).toBeEnabled();
    expect(JSON.parse(window.localStorage.getItem("procrastinot:v1") ?? "null").archives).toEqual([]);
  });

  it("lets the learner cancel, then confirm archiving a previous day as read-only history", async () => {
    const user = userEvent.setup();
    const day = createSampleDay("2026-10-12");
    const proposal = createRecoveryProposal(day, 7 * 60);
    const savedDocument = {
      version: 1,
      activeDay: day,
      proposals: [proposal],
      archives: [],
    };
    window.localStorage.setItem("procrastinot:v1", JSON.stringify(savedDocument));
    const beforeConfirmation = window.localStorage.getItem("procrastinot:v1");

    render(<App />);

    expect(screen.getByText("This plan belongs to a different day. Your saved work is preserved.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset sample day" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add task" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Edit task" }).every((button) => button.hasAttribute("disabled"))).toBe(true);
    expect(screen.queryByRole("button", { name: "Approve revised plan" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Start Today's Sample Day" }));
    expect(screen.getByRole("dialog", { name: "Start today's sample day?" }))
      .toHaveTextContent("will be archived for reference");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(window.localStorage.getItem("procrastinot:v1")).toBe(beforeConfirmation);
    expect(screen.getByText("This plan belongs to a different day. Your saved work is preserved.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Start Today's Sample Day" }));
    await user.click(screen.getByRole("button", { name: "Confirm and start today's sample" }));

    const saved = JSON.parse(window.localStorage.getItem("procrastinot:v1") ?? "null");
    expect(saved.activeDay.date).toBe("2026-10-13");
    expect(saved.activeDay.commitments.some((commitment: { isSimulated: boolean }) => commitment.isSimulated)).toBe(false);
    expect(saved.proposals).toEqual([]);
    expect(saved.archives).toEqual([expect.objectContaining({
      id: "archive-2026-10-12",
      date: "2026-10-12",
      archivedAt: expect.any(String),
      dayPlan: day,
      proposals: [proposal],
    })]);
    expect(screen.queryByText("This plan belongs to a different day. Your saved work is preserved.")).not.toBeInTheDocument();

    await user.click(screen.getByText(/View saved plan from/));
    expect(within(screen.getByRole("list", { name: "Archived tasks from 2026-10-12" })).getByText("Review class notes")).toBeInTheDocument();
    expect(screen.getByText("Saved proposal history (1)")).toBeInTheDocument();
  });

  it("detects a date change when the page resumes", () => {
    render(<App />);

    vi.setSystemTime(new Date(2026, 9, 14, 8, 0));
    fireEvent(document, new Event("visibilitychange"));

    expect(screen.getByText("This plan belongs to a different day. Your saved work is preserved.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset sample day" })).toBeDisabled();
  });

  it("keeps the prior day active and reports a failed archive write", async () => {
    const user = userEvent.setup();
    const day = createSampleDay("2026-10-12");
    window.localStorage.setItem("procrastinot:v1", JSON.stringify({
      version: 1,
      activeDay: day,
      proposals: [],
      archives: [],
    }));
    const beforeConfirmation = window.localStorage.getItem("procrastinot:v1");

    render(<App />);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage write denied");
    });

    await user.click(screen.getByRole("button", { name: "Start Today's Sample Day" }));
    await user.click(screen.getByRole("button", { name: "Confirm and start today's sample" }));

    expect(screen.getByRole("status")).toHaveTextContent("The previous day could not be archived");
    expect(screen.getByText("This plan belongs to a different day. Your saved work is preserved.")).toBeInTheDocument();
    expect(window.localStorage.getItem("procrastinot:v1")).toBe(beforeConfirmation);
  });

  it("shows a recovery notice when saved data is malformed and keeps the sample usable", () => {
    window.localStorage.setItem("procrastinot:v1", "{invalid json");

    render(<App />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Saved planner data could not be read. A fresh sample day is ready.",
    );
    expect(screen.getByRole("heading", { name: "Today's schedule" })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Study tasks" })).getByText("Review class notes")).toBeInTheDocument();
  });

  it("shows a recovery notice when browser storage cannot be read and keeps the sample usable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage access denied");
    });

    render(<App />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Browser storage is unavailable. Your changes may not survive a refresh.",
    );
    expect(screen.getByRole("heading", { name: "Today's schedule" })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Study tasks" })).getByText("Review class notes")).toBeInTheDocument();
  });

  it("shows an unapplied proposal while the accepted schedule remains visible", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("heading", { name: "Today's schedule" })).toBeInTheDocument();
    const existingSession = screen.getAllByText("Revise Computer Networks")[0]!;

    await confirmSurpriseLab(user);

    expect(screen.getByRole("heading", { name: "Your recovery plan" })).toBeInTheDocument();
    expect(screen.getAllByText("Not applied")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Surprise lab added" })).toBeDisabled();
    expect(existingSession).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Revise Computer Networks overlaps the fixed surprise lab");

    const currentPlan = screen.getByRole("region", { name: "Current plan" });
    const suggestedPlan = screen.getByRole("region", { name: "Suggested plan" });
    expect(within(currentPlan).getByText("Revise Computer Networks")).toBeInTheDocument();
    expect(within(currentPlan).getByText(/4:30 PM/)).toBeInTheDocument();
    expect(within(suggestedPlan).getAllByText("Surprise lab")).toHaveLength(2);
    expect(screen.getAllByText(/No remaining available study window is long enough/)).toHaveLength(2);
    const taskOutcomes = screen.getByRole("list", { name: "Task outcomes" });
    expect(within(taskOutcomes).getAllByRole("listitem")).toHaveLength(5);
    for (const taskName of [
      "Review class notes",
      "Revise Computer Networks",
      "Finish DBMS lab report",
      "Prepare for the Data Structures exam",
      "Practice calculus problems",
    ]) {
      expect(within(taskOutcomes).getByText(taskName)).toBeInTheDocument();
    }
    expect(within(taskOutcomes).getByText("Completed")).toBeInTheDocument();
    expect(within(taskOutcomes).getAllByText("At risk")).toHaveLength(2);
    expect(within(taskOutcomes).getAllByText("Not scheduled today")).toHaveLength(2);
  });

  it("keeps the day unchanged when surprise-lab confirmation is cancelled", async () => {
    const user = userEvent.setup();
    render(<App />);
    const original = JSON.parse(window.localStorage.getItem("procrastinot:v1") ?? "null");
    const originalStorage = window.localStorage.getItem("procrastinot:v1");
    const addButton = screen.getByRole("button", { name: "Add surprise lab" });

    await user.click(addButton);
    let dialog = screen.getByRole("dialog", { name: "Add the surprise lab?" });
    expect(dialog).toHaveTextContent("fixed 4:00–6:00 PM lab");
    expect(window.localStorage.getItem("procrastinot:v1")).toBe(originalStorage);
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(addButton).toHaveFocus();
    expect(window.localStorage.getItem("procrastinot:v1")).toBe(originalStorage);

    await user.click(addButton);
    dialog = screen.getByRole("dialog", { name: "Add the surprise lab?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(addButton).toHaveFocus();
    expect(JSON.parse(window.localStorage.getItem("procrastinot:v1") ?? "null")).toEqual(original);
    expect(screen.queryByRole("heading", { name: "Your recovery plan" })).not.toBeInTheDocument();

    await user.click(addButton);
    await user.click(screen.getByRole("button", { name: "Add lab and create proposal" }));

    const saved = JSON.parse(window.localStorage.getItem("procrastinot:v1") ?? "null");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your recovery plan" })).toHaveFocus();
    expect(saved.activeDay.commitments.some((item: { isSimulated: boolean }) => item.isSimulated)).toBe(true);
    expect(saved.activeDay.acceptedSessions).toEqual(original.activeDay.acceptedSessions);
    expect(saved.proposals).toHaveLength(1);
    expect(saved.proposals[0].status).toBe("current");
  });

  it("applies a current proposal while retaining completed sessions and the fixed lab", async () => {
    vi.setSystemTime(new Date(2026, 9, 13, 7, 0));
    const user = userEvent.setup();
    render(<App />);
    const original = JSON.parse(window.localStorage.getItem("procrastinot:v1") ?? "null");

    await confirmSurpriseLab(user);
    await user.click(screen.getByRole("button", { name: "Approve revised plan" }));

    expect(screen.getByText("Approved", { selector: ".proposal-badge" })).toBeInTheDocument();
    const saved = JSON.parse(window.localStorage.getItem("procrastinot:v1") ?? "null");
    expect(saved.proposals[0].status).toBe("approved");
    expect(saved.activeDay.acceptedSessions.filter((session: { status: string }) => session.status === "completed"))
      .toEqual(original.activeDay.acceptedSessions.filter((session: { status: string }) => session.status === "completed"));
    expect(saved.activeDay.commitments.some(
      (commitment: { isSimulated: boolean; startMinute: number; endMinute: number }) =>
        commitment.isSimulated && commitment.startMinute === 960 && commitment.endMinute === 1080,
    )).toBe(true);
    expect(saved.activeDay.acceptedSessions.filter((session: { status: string }) => session.status === "planned"))
      .toEqual(saved.proposals[0].proposedSessions.filter((session: { status: string }) => session.status === "planned"));
  });

  it("keeps the original schedule on rejection and restores the sample on reset", async () => {
    const user = userEvent.setup();
    render(<App />);
    const original = JSON.parse(window.localStorage.getItem("procrastinot:v1") ?? "null");

    await confirmSurpriseLab(user);
    await user.click(screen.getByRole("button", { name: "Keep original plan" }));

    expect(screen.getByText("Rejected", { selector: ".proposal-badge" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("overlaps the fixed surprise lab");
    const rejected = JSON.parse(window.localStorage.getItem("procrastinot:v1") ?? "null");
    expect(rejected.activeDay.acceptedSessions).toEqual(original.activeDay.acceptedSessions);
    expect(rejected.activeDay.commitments.some((commitment: { isSimulated: boolean }) => commitment.isSimulated)).toBe(true);
    expect(screen.getByRole("button", { name: "Generate updated plan" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Generate updated plan" }));
    expect(screen.getByText("Not applied", { selector: ".proposal-badge" })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("procrastinot:v1") ?? "null").proposals.at(-1).status).toBe("current");

    await user.click(screen.getByRole("button", { name: "Reset sample day" }));

    expect(screen.queryByRole("heading", { name: "Your recovery plan" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add surprise lab" })).toBeEnabled();
    const reset = JSON.parse(window.localStorage.getItem("procrastinot:v1") ?? "null");
    expect(reset.proposals).toEqual([]);
    expect(reset.activeDay.acceptedSessions).toEqual(original.activeDay.acceptedSessions);
    expect(reset.activeDay.commitments.some((commitment: { isSimulated: boolean }) => commitment.isSimulated)).toBe(false);
  });

  it("marks a proposal outdated rather than applying it when a suggested start has passed", async () => {
    vi.setSystemTime(new Date(2026, 9, 13, 7, 0));
    const user = userEvent.setup();
    render(<App />);
    const acceptedSessions = JSON.parse(window.localStorage.getItem("procrastinot:v1") ?? "null").activeDay.acceptedSessions;

    await confirmSurpriseLab(user);
    const savedProposal = JSON.parse(window.localStorage.getItem("procrastinot:v1") ?? "null").proposals[0];
    const earliestStart = Math.min(
      ...savedProposal.proposedSessions
        .filter((session: { status: string }) => session.status === "planned")
        .map((session: { startMinute: number }) => session.startMinute),
    );
    vi.setSystemTime(new Date(2026, 9, 13, Math.floor((earliestStart + 1) / 60), (earliestStart + 1) % 60));

    await user.click(screen.getByRole("button", { name: "Approve revised plan" }));

    expect(screen.getByText("Outdated", { selector: ".proposal-badge" })).toBeInTheDocument();
    expect(screen.getAllByRole("status").some((status) =>
      status.textContent?.includes("whose start time has already passed"),
    )).toBe(true);
    const saved = JSON.parse(window.localStorage.getItem("procrastinot:v1") ?? "null");
    expect(saved.activeDay.acceptedSessions).toEqual(acceptedSessions);
    expect(saved.proposals[0].status).toBe("outdated");
  });

  it("validates task fields, keeps entered values, and disables an invalid save", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Add task" }));
    const dialog = screen.getByRole("dialog", { name: "Add a study task" });
    const form = within(dialog).getByRole("form", { name: "Add a study task" });
    const nameInput = within(form).getByLabelText(/Task name/);
    const durationInput = within(form).getByLabelText(/Duration in minutes/);
    await user.click(nameInput);
    await user.click(durationInput);
    await user.type(durationInput, "75");
    await user.tab();

    expect(within(form).getByText("Please enter a task name.")).toBeInTheDocument();
    expect(nameInput).toHaveValue("");
    expect(durationInput).toHaveValue(75);
    expect(within(form).getByRole("button", { name: "Add task" })).toBeDisabled();
  });

  it("opens the add-task dialog with the existing defaults", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Add task" }));

    const dialog = screen.getByRole("dialog", { name: "Add a study task" });
    const form = within(dialog).getByRole("form", { name: "Add a study task" });
    expect(within(form).getByLabelText(/Task name/)).toHaveValue("");
    expect(within(form).getByLabelText(/Duration in minutes/)).toHaveValue(null);
    expect(within(form).getByLabelText(/Deadline/)).toHaveValue("");
    expect(within(form).getByLabelText("Priority")).toHaveValue("medium");
    expect(within(form).getByLabelText("Completion status")).toHaveValue("notStarted");
    expect(within(form).getByLabelText("Completion status").querySelectorAll("option"))
      .toHaveLength(2);
    expect(within(form).getByRole("option", { name: "Not completed" })).toHaveValue("notStarted");
    expect(within(form).getByRole("option", { name: "Completed" })).toHaveValue("completed");
    expect(within(form).getByRole("button", { name: "Cancel" })).toBeVisible();
    expect(within(dialog).queryByText("Please enter a task name.")).not.toBeInTheDocument();

    await user.click(within(form).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the edit-task dialog with the selected task's values", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: "Edit task" })[1]!);

    const dialog = screen.getByRole("dialog", { name: "Edit Revise Computer Networks" });
    const form = within(dialog).getByRole("form", { name: "Edit Revise Computer Networks" });
    expect(within(form).getByLabelText(/Task name/)).toHaveValue("Revise Computer Networks");
    expect(within(form).getByLabelText(/Duration in minutes/)).toHaveValue(90);
    expect(within(form).getByLabelText(/Deadline/)).toHaveValue("2026-10-13");
    expect(within(form).getByLabelText("Priority")).toHaveValue("high");
    expect(within(form).getByLabelText("Completion status")).toHaveValue("notStarted");
    expect(within(form).getByLabelText("From")).toHaveValue("");
    expect(within(form).getByLabelText("To")).toHaveValue("");
  });

  it("requires confirmation before discarding unsaved task edits", async () => {
    const user = userEvent.setup();
    render(<App />);
    const originalTasks = JSON.parse(window.localStorage.getItem("procrastinot:v1") ?? "null").activeDay.tasks;

    await user.click(screen.getByRole("button", { name: "Add task" }));
    let dialog = screen.getByRole("dialog", { name: "Add a study task" });
    const form = within(dialog).getByRole("form", { name: "Add a study task" });
    const nameInput = within(form).getByLabelText(/Task name/);
    await user.type(nameInput, "Unsaved task");
    await user.click(within(form).getByRole("button", { name: "Cancel" }));

    dialog = screen.getByRole("dialog", { name: "Discard unsaved task changes?" });
    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("dialog", { name: "Add a study task" })).toBeInTheDocument();
    expect(within(screen.getByRole("form", { name: "Add a study task" })).getByLabelText(/Task name/))
      .toHaveValue("Unsaved task");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    dialog = screen.getByRole("dialog", { name: "Discard unsaved task changes?" });
    await user.click(within(dialog).getByRole("button", { name: "Discard changes" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("procrastinot:v1") ?? "null").activeDay.tasks).toEqual(originalTasks);
    expect(within(screen.getByRole("list", { name: "Study tasks" })).queryByText("Unsaved task")).not.toBeInTheDocument();
  });

  it("uses Escape to request discard confirmation and Escape again to return to editing", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Add task" }));
    let dialog = screen.getByRole("dialog", { name: "Add a study task" });
    const form = within(dialog).getByRole("form", { name: "Add a study task" });
    const nameInput = within(form).getByLabelText(/Task name/);
    await user.type(nameInput, "Keep this draft");
    await user.keyboard("{Escape}");

    dialog = screen.getByRole("dialog", { name: "Discard unsaved task changes?" });
    await user.keyboard("{Escape}");

    dialog = screen.getByRole("dialog", { name: "Add a study task" });
    expect(within(dialog).getByLabelText(/Task name/)).toHaveValue("Keep this draft");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps invalid preferred-time input and its error inside the task dialog", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Add task" }));
    const dialog = screen.getByRole("dialog", { name: "Add a study task" });
    const form = within(dialog).getByRole("form", { name: "Add a study task" });
    await user.type(within(form).getByLabelText(/Task name/), "Invalid time task");
    await user.type(within(form).getByLabelText(/Duration in minutes/), "60");
    await user.type(within(form).getByLabelText(/Deadline/), "2026-10-14");
    await user.type(within(form).getByLabelText("From"), "17:00");
    await user.type(within(form).getByLabelText("To"), "16:00");
    await user.click(within(form).getByRole("button", { name: "Add task" }));

    expect(within(dialog).getByText("Preferred end time must be later than its start.")).toBeInTheDocument();
    expect(within(form).getByLabelText(/Task name/)).toHaveValue("Invalid time task");
    expect(within(form).getByLabelText("From")).toHaveValue("17:00");
    expect(within(form).getByLabelText("To")).toHaveValue("16:00");
    expect(screen.getByRole("dialog", { name: "Add a study task" })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("procrastinot:v1") ?? "null").activeDay.tasks)
      .toHaveLength(5);
  });

  it("adds a valid task from the dialog and closes after saving", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Add task" }));
    const dialog = screen.getByRole("dialog", { name: "Add a study task" });
    const form = within(dialog).getByRole("form", { name: "Add a study task" });
    await user.type(within(form).getByLabelText(/Task name/), "New saved task");
    await user.type(within(form).getByLabelText(/Duration in minutes/), "45");
    await user.type(within(form).getByLabelText(/Deadline/), "2026-10-14");
    await user.click(within(form).getByRole("button", { name: "Add task" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Study tasks" })).getByText("New saved task")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("procrastinot:v1") ?? "null").activeDay.tasks.at(-1))
      .toMatchObject({ name: "New saved task", durationMinutes: 45, deadlineDate: "2026-10-14" });
  });

  it("keeps an invalid task out of a generated recovery proposal", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Add task" }));
    const dialog = screen.getByRole("dialog", { name: "Add a study task" });
    const form = within(dialog).getByRole("form", { name: "Add a study task" });
    await user.type(within(form).getByLabelText(/Task name/), "Invalid duration task");
    const durationInput = within(form).getByLabelText(/Duration in minutes/);
    await user.type(durationInput, "0");
    await user.tab();

    expect(within(form).getByText("Duration must be between 1 and 480 minutes.")).toBeInTheDocument();
    expect(within(form).getByRole("button", { name: "Add task" })).toBeDisabled();

    await user.click(within(form).getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("dialog", { name: "Discard unsaved task changes?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    await confirmSurpriseLab(user);

    const outcomes = screen.getByRole("list", { name: "Task outcomes" });
    expect(within(outcomes).getAllByRole("listitem")).toHaveLength(5);
    expect(within(outcomes).queryByText("Invalid duration task")).not.toBeInTheDocument();
  });

  it("saves edits, preserves an outdated proposal snapshot, and persists after remount", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await confirmSurpriseLab(user);
    await user.click(screen.getAllByRole("button", { name: "Edit task" })[1]!);
    const editForm = screen.getByRole("form", { name: "Edit Revise Computer Networks" });
    const nameInput = within(editForm).getByLabelText(/Task name/);
    await user.clear(nameInput);
    await user.type(nameInput, "Updated networks revision");
    await user.click(within(editForm).getByRole("button", { name: "Save task" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Outdated", { selector: ".proposal-badge" })).toBeInTheDocument();
    expect(screen.getByText(
      "Your tasks have changed since this recovery plan was created. Review an updated plan before applying changes.",
    )).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Study tasks" })).getByText("Updated networks revision")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Task outcomes" })).getByText("Revise Computer Networks")).toBeInTheDocument();

    const saved = JSON.parse(window.localStorage.getItem("procrastinot:v1") ?? "null");
    expect(saved.activeDay.tasks[1].name).toBe("Updated networks revision");
    expect(saved.proposals[0].status).toBe("outdated");
    const oldProposalSnapshot = saved.proposals[0];
    unmount();

    render(<App />);
    expect(within(screen.getByRole("list", { name: "Study tasks" })).getByText("Updated networks revision")).toBeInTheDocument();
    expect(screen.getByText("Outdated", { selector: ".proposal-badge" })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("procrastinot:v1") ?? "null").proposals[0]).toEqual(oldProposalSnapshot);
  });

  it("adds and edits fixed commitments, invalidating a proposal and persisting the change", async () => {
    const user = userEvent.setup();
    render(<App />);
    await confirmSurpriseLab(user);
    await user.click(screen.getByRole("button", { name: "Add commitment" }));
    const dialog = screen.getByRole("dialog", { name: "Add a fixed commitment" });
    const form = within(dialog).getByRole("form", { name: "Add a fixed commitment" });
    await user.type(within(form).getByLabelText("Commitment name"), "Project meeting");
    fireEvent.change(within(form).getByLabelText("Starts"), { target: { value: "11:00" } });
    fireEvent.change(within(form).getByLabelText("Ends"), { target: { value: "12:00" } });
    await user.selectOptions(within(form).getByLabelText("Type"), "other");
    await user.click(within(form).getByRole("button", { name: "Add commitment" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Fixed commitments" })).getByText("Project meeting")).toBeInTheDocument();
    expect(screen.getByText("Outdated", { selector: ".proposal-badge" })).toBeInTheDocument();

    const editButtons = screen.getAllByRole("button", { name: "Edit commitment" });
    await user.click(editButtons[editButtons.length - 1]!);
    const editDialog = screen.getByRole("dialog", { name: "Edit Project meeting" });
    const editForm = within(editDialog).getByRole("form", { name: "Edit Project meeting" });
    const titleInput = within(editForm).getByLabelText("Commitment name");
    await user.clear(titleInput);
    await user.type(titleInput, "Updated project meeting");
    await user.click(within(editForm).getByRole("button", { name: "Save commitment" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Fixed commitments" })).getByText("Updated project meeting")).toBeInTheDocument();
    const saved = JSON.parse(window.localStorage.getItem("procrastinot:v1") ?? "null");
    expect(saved.activeDay.commitments.some((item: { title: string }) => item.title === "Updated project meeting")).toBe(true);
  });

  it("keeps commitment validation in the dialog and confirms before discarding edits", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Add commitment" }));
    let dialog = screen.getByRole("dialog", { name: "Add a fixed commitment" });
    const form = within(dialog).getByRole("form", { name: "Add a fixed commitment" });
    const titleInput = within(form).getByLabelText("Commitment name");
    const startInput = within(form).getByLabelText("Starts");
    const endInput = within(form).getByLabelText("Ends");
    await user.type(titleInput, "Draft meeting");
    fireEvent.change(startInput, { target: { value: "13:00" } });
    fireEvent.change(endInput, { target: { value: "12:00" } });
    fireEvent.blur(endInput);

    expect(within(dialog).getByText("End time must be later than start time.")).toBeInTheDocument();
    expect(titleInput).toHaveValue("Draft meeting");
    expect(startInput).toHaveValue("13:00");
    expect(endInput).toHaveValue("12:00");

    await user.keyboard("{Escape}");
    dialog = screen.getByRole("dialog", { name: "Discard unsaved commitment changes?" });
    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("dialog", { name: "Add a fixed commitment" })).toBeInTheDocument();
    expect(within(screen.getByRole("form", { name: "Add a fixed commitment" }))
      .getByLabelText("Commitment name")).toHaveValue("Draft meeting");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Fixed commitments" })).queryByText("Draft meeting"))
      .not.toBeInTheDocument();
  });

  it("closes a clean commitment dialog with Escape and restores focus to its opener", async () => {
    const user = userEvent.setup();
    render(<App />);

    const addCommitmentButton = screen.getByRole("button", { name: "Add commitment" });
    await user.click(addCommitmentButton);
    expect(screen.getByRole("dialog", { name: "Add a fixed commitment" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(addCommitmentButton).toHaveFocus();
  });

  it("shows the two task statuses and saves completion without rescheduling completed work", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    render(<App />);
    const taskList = screen.getByRole("list", { name: "Study tasks" });

    expect(within(taskList).getAllByText(/Not completed/)).toHaveLength(4);
    expect(within(taskList).getByText(/\bCompleted\b/)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Penguin, the consistency buddy" })).not.toBeInTheDocument();
    const before = JSON.parse(window.localStorage.getItem("procrastinot:v1") ?? "null");

    await user.click(screen.getAllByRole("button", { name: "Edit task" })[1]!);
    const editDialog = screen.getByRole("dialog", { name: "Edit Revise Computer Networks" });
    const editForm = within(editDialog).getByRole("form", { name: "Edit Revise Computer Networks" });
    await user.selectOptions(within(editForm).getByLabelText("Completion status"), "completed");
    await user.click(within(editForm).getByRole("button", { name: "Save task" }));

    expect(within(taskList).getByText("Revise Computer Networks").parentElement)
      .toHaveTextContent("Completed");
    expect(screen.getByRole("status")).toHaveTextContent("Nice progress: Revise Computer Networks is marked complete.");
    expect(screen.getByRole("img", { name: "Penguin, the consistency buddy" }))
      .toHaveAttribute("src", "/assets/procrastinot-penguin-mascot.png");
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    await confirmSurpriseLab(user);
    const outcomes = screen.getByRole("list", { name: "Task outcomes" });
    expect(within(outcomes).getAllByText("Completed")).toHaveLength(2);
    const saved = JSON.parse(window.localStorage.getItem("procrastinot:v1") ?? "null");
    expect(saved.activeDay.tasks[1].status).toBe("completed");
    expect(saved.activeDay.acceptedSessions.filter((session: { status: string }) => session.status === "completed"))
      .toEqual(before.activeDay.acceptedSessions.filter((session: { status: string }) => session.status === "completed"));
  });
});
