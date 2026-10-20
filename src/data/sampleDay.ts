import type { DayPlan, Task, TimeInterval } from "../types/planner";

const minutes = (hour: number, minute = 0): number => hour * 60 + minute;

function dateOffset(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(year, month - 1, day + days);
  const yyyy = result.getFullYear();
  const mm = String(result.getMonth() + 1).padStart(2, "0");
  const dd = String(result.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function localDateString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function task(
  today: string,
  input: Omit<Task, "deadlineDate"> & { deadlineOffset: number },
): Task {
  const { deadlineOffset, ...details } = input;
  return { ...details, deadlineDate: dateOffset(today, deadlineOffset) };
}

function interval(startHour: number, startMinute: number, endHour: number, endMinute: number): TimeInterval {
  return {
    startMinute: minutes(startHour, startMinute),
    endMinute: minutes(endHour, endMinute),
  };
}

export function createSampleDay(date: string): DayPlan {
  const tasks = [
    task(date, {
      id: "review-notes",
      name: "Review class notes",
      durationMinutes: 30,
      priority: "medium",
      status: "completed",
      originalOrder: 0,
      deadlineOffset: 0,
    }),
    task(date, {
      id: "revise-networks",
      name: "Revise Computer Networks",
      durationMinutes: 90,
      priority: "high",
      status: "notStarted",
      originalOrder: 1,
      deadlineOffset: 0,
    }),
    task(date, {
      id: "dbms-report",
      name: "Finish DBMS lab report",
      durationMinutes: 90,
      priority: "medium",
      status: "notStarted",
      originalOrder: 2,
      deadlineOffset: 1,
    }),
    task(date, {
      id: "data-structures",
      name: "Prepare for the Data Structures exam",
      durationMinutes: 300,
      priority: "low",
      status: "notStarted",
      originalOrder: 3,
      deadlineOffset: 0,
    }),
    task(date, {
      id: "calculus",
      name: "Practice calculus problems",
      durationMinutes: 60,
      priority: "low",
      status: "notStarted",
      originalOrder: 4,
      deadlineOffset: 5,
    }),
  ];

  return {
    date,
    tasks,
    commitments: [
      {
        id: "lecture",
        title: "Morning lecture",
        kind: "class",
        startMinute: minutes(9),
        endMinute: minutes(10, 30),
        isSimulated: false,
      },
      {
        id: "class",
        title: "Afternoon class",
        kind: "class",
        startMinute: minutes(14),
        endMinute: minutes(15),
        isSimulated: false,
      },
    ],
    availabilityWindows: [interval(7, 30, 12, 0), interval(13, 0, 18, 0), interval(18, 0, 22, 30)],
    protectedSleep: [interval(0, 0, 7, 0), interval(22, 30, 24, 0)],
    unavailablePeriods: [interval(12, 0, 13, 0)],
    acceptedSessions: [
      {
        id: "session-review",
        taskId: "review-notes",
        startMinute: minutes(8),
        endMinute: minutes(8, 30),
        status: "completed",
      },
      {
        id: "session-networks",
        taskId: "revise-networks",
        startMinute: minutes(16, 30),
        endMinute: minutes(18),
        status: "planned",
      },
      {
        id: "session-dbms",
        taskId: "dbms-report",
        startMinute: minutes(10, 30),
        endMinute: minutes(12),
        status: "planned",
      },
      {
        id: "session-calculus",
        taskId: "calculus",
        startMinute: minutes(15),
        endMinute: minutes(16),
        status: "planned",
      },
    ],
    inputRevision: 0,
  };
}
