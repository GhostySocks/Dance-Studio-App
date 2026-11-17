import { beforeEach, describe, expect, it, vi } from "vitest";

interface FakeEnrollment {
  id: string;
  studentId: string;
  sessionId: string;
  status: "ACTIVE" | "WAITLIST" | "CANCELLED";
  makeupForId: string | null;
  registrationId: string | null;
}

const HOUR = 60 * 60 * 1000;

const state = vi.hoisted(() => ({
  attendance: {} as Record<
    string,
    { status: string; lockedAt: Date | null; sessionId: string; enrollmentId: string }
  >,
  sessions: {} as Record<string, { startTime: Date; maxCapacity: number; active: boolean }>,
  enrollments: [] as FakeEnrollment[],
  audit: [] as string[],
  /** Attendance written when a past class is counted as a makeup */
  recorded: [] as { enrollmentId: string; sessionId: string; status: string; lockedAt: Date | null }[],
  /** When the teacher submitted each class (absent = not submitted) */
  submittedAt: {} as Record<string, Date>,
  /** Classes the student teaches themself */
  ownClasses: new Set<string>(),
}));

const db = vi.hoisted(() => {
  const activeIn = (sessionId: string) =>
    state.enrollments.filter((e) => e.sessionId === sessionId && e.status === "ACTIVE").length;
  const tx = {
    // (sql, attendanceId, sessionId): the lock also says whether the student teaches the class
    $queryRaw: vi.fn(async (_sql: unknown, _attendanceId: string, sessionId: string) =>
      state.sessions[sessionId] ? [{ id: sessionId, ownClass: state.ownClasses.has(sessionId) }] : []
    ),
    attendance: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = state.attendance[where.id];
        if (!row) return null;
        const enrollment = state.enrollments.find((e) => e.id === row.enrollmentId)!;
        const makeup = state.enrollments.find((e) => e.makeupForId === where.id) ?? null;
        return {
          status: row.status,
          lockedAt: row.lockedAt,
          sessionId: row.sessionId,
          enrollment: { studentId: enrollment.studentId, makeupForId: enrollment.makeupForId },
          makeup: makeup ? { id: makeup.id, status: makeup.status } : null,
        };
      }),
      findFirst: vi.fn(async ({ where }: { where: { sessionId: string } }) =>
        state.submittedAt[where.sessionId] ? { lockedAt: state.submittedAt[where.sessionId] } : null
      ),
      upsert: vi.fn(
        async ({ create }: { create: { enrollmentId: string; sessionId: string; status: string; lockedAt: Date | null } }) => {
          state.recorded.push(create);
        }
      ),
      deleteMany: vi.fn(async ({ where }: { where: { enrollmentId: string } }) => {
        state.recorded = state.recorded.filter((r) => r.enrollmentId !== where.enrollmentId);
      }),
    },
    classSession: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = state.sessions[where.id];
        if (!row) return null;
        return {
          startTime: row.startTime,
          maxCapacity: row.maxCapacity,
          template: { isActive: row.active },
          _count: { enrollments: activeIn(where.id) },
        };
      }),
    },
    enrollment: {
      findUnique: vi.fn(
        async ({ where }: { where: { id?: string; studentId_sessionId?: { studentId: string; sessionId: string } } }) => {
          const key = where.studentId_sessionId;
          const row = key
            ? state.enrollments.find((e) => e.studentId === key.studentId && e.sessionId === key.sessionId)
            : state.enrollments.find((e) => e.id === where.id);
          if (!row) return null;
          return { ...row, session: { id: row.sessionId, startTime: state.sessions[row.sessionId].startTime } };
        }
      ),
      create: vi.fn(async ({ data }: { data: Omit<FakeEnrollment, "id"> }) => {
        const row = { ...data, id: `enr-${state.enrollments.length + 1}` };
        state.enrollments.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeEnrollment> }) => {
        const row = state.enrollments.find((e) => e.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: { action: string } }) => {
        state.audit.push(data.action);
      }),
    },
  };
  return { ...tx, $transaction: vi.fn(async (run: (t: typeof tx) => unknown) => run(tx)) };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { bookMakeup, cancelMakeup } from "@/lib/db/student-attendance";
import { makeupState, summarizeAttendance } from "@/lib/makeups";

const book = (sessionId = "jazz", attendanceId = "att-1") =>
  bookMakeup({ attendanceId, sessionId, actorId: "parent-1" });
/** As studio staff, who may count a class that has already taken place */
const bookAsStaff = (sessionId: string) =>
  bookMakeup({ attendanceId: "att-1", sessionId, actorId: "admin-1", allowPast: true });

beforeEach(() => {
  vi.clearAllMocks();
  const now = Date.now();
  state.audit = [];
  state.recorded = [];
  state.submittedAt = {};
  state.ownClasses = new Set();
  state.sessions = {
    ballet: { startTime: new Date(now - 48 * HOUR), maxCapacity: 10, active: true },
    jazz: { startTime: new Date(now + 48 * HOUR), maxCapacity: 2, active: true },
    tap: { startTime: new Date(now + 72 * HOUR), maxCapacity: 10, active: true },
    past: { startTime: new Date(now - HOUR), maxCapacity: 10, active: true },
  };
  // Mia missed ballet two days ago; the teacher has submitted attendance
  state.enrollments = [
    { id: "enr-ballet", studentId: "mia", sessionId: "ballet", status: "ACTIVE", makeupForId: null, registrationId: "reg-1" },
  ];
  state.attendance = {
    "att-1": { status: "ABSENT", lockedAt: new Date(now - 47 * HOUR), sessionId: "ballet", enrollmentId: "enr-ballet" },
  };
});

describe("bookMakeup", () => {
  it("books the student into the chosen class as a makeup that is never billed", async () => {
    const enrollment = await book();
    expect(enrollment).toMatchObject({
      studentId: "mia",
      sessionId: "jazz",
      status: "ACTIVE",
      makeupForId: "att-1",
      registrationId: null,
    });
    expect(state.audit).toEqual(["MAKEUP_BOOKED"]);
  });

  it("locks the class row first, like any enrollment", async () => {
    await book();
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      db.enrollment.create.mock.invocationCallOrder[0]
    );
  });

  it("accepts an excused absence too", async () => {
    state.attendance["att-1"].status = "EXCUSED";
    await expect(book()).resolves.toMatchObject({ makeupForId: "att-1" });
  });

  it.each(["PRESENT", "LATE"])("refuses a class the student attended (%s)", async (status) => {
    state.attendance["att-1"].status = status;
    await expect(book()).rejects.toThrow(/absent or excused/);
  });

  it("refuses until the teacher has submitted attendance", async () => {
    // Before submission every student is recorded absent by default
    state.attendance["att-1"].lockedAt = null;
    await expect(book()).rejects.toThrow(/absent or excused/);
    expect(state.enrollments).toHaveLength(1);
  });

  it("allows one makeup per missed class", async () => {
    await book("jazz");
    await expect(book("tap")).rejects.toThrow(/already booked for this class/);
  });

  it("never takes a spot in a full class", async () => {
    state.enrollments.push(
      { id: "a", studentId: "s1", sessionId: "jazz", status: "ACTIVE", makeupForId: null, registrationId: null },
      { id: "b", studentId: "s2", sessionId: "jazz", status: "ACTIVE", makeupForId: null, registrationId: null }
    );
    await expect(book("jazz")).rejects.toThrow(/full/);
    expect(state.enrollments.filter((e) => e.sessionId === "jazz")).toHaveLength(2);
  });

  it("ignores waitlisted students when counting spots", async () => {
    state.enrollments.push(
      { id: "a", studentId: "s1", sessionId: "jazz", status: "ACTIVE", makeupForId: null, registrationId: null },
      { id: "b", studentId: "s2", sessionId: "jazz", status: "WAITLIST", makeupForId: null, registrationId: null }
    );
    await expect(book("jazz")).resolves.toMatchObject({ status: "ACTIVE" });
  });

  it("refuses a class that has already started, is unknown or is inactive", async () => {
    await expect(book("past")).rejects.toThrow(/no longer available/);
    await expect(book("nope")).rejects.toThrow(/no longer available/);
    state.sessions.tap.active = false;
    await expect(book("tap")).rejects.toThrow(/no longer available/);
  });

  it("refuses a class the student teaches", async () => {
    state.ownClasses.add("jazz");
    await expect(book("jazz")).rejects.toThrow(/a class they teach/);
    expect(state.enrollments.some((e) => e.makeupForId !== null)).toBe(false);
  });

  it("refuses a class the student is already in", async () => {
    state.enrollments.push({
      id: "x", studentId: "mia", sessionId: "jazz", status: "ACTIVE", makeupForId: null, registrationId: null,
    });
    await expect(book("jazz")).rejects.toThrow(/already booked into that class/);
  });

  it("reuses a cancelled booking in the same class", async () => {
    state.enrollments.push({
      id: "old", studentId: "mia", sessionId: "jazz", status: "CANCELLED", makeupForId: null, registrationId: "reg-9",
    });
    const enrollment = await book("jazz");
    expect(enrollment).toMatchObject({ id: "old", status: "ACTIVE", makeupForId: "att-1", registrationId: null });
  });

  it("does not let a missed makeup be made up again", async () => {
    await book("jazz");
    const makeup = state.enrollments.find((e) => e.makeupForId === "att-1")!;
    state.attendance["att-2"] = {
      status: "ABSENT", lockedAt: new Date(), sessionId: "jazz", enrollmentId: makeup.id,
    };
    await expect(book("tap", "att-2")).rejects.toThrow(/cannot be made up again/);
  });
});

describe("counting a past class as a makeup", () => {
  it("is refused for families", async () => {
    await expect(book("past")).rejects.toThrow(/no longer available/);
    expect(state.recorded).toHaveLength(0);
  });

  it("lets staff count a class the student turned up to, and marks them present", async () => {
    const enrollment = await bookAsStaff("past");
    expect(enrollment).toMatchObject({ sessionId: "past", status: "ACTIVE", makeupForId: "att-1" });
    expect(state.recorded).toEqual([
      expect.objectContaining({ enrollmentId: enrollment.id, sessionId: "past", status: "PRESENT" }),
    ]);
  });

  it("ignores capacity: the class has already happened", async () => {
    state.sessions.past.maxCapacity = 1;
    state.enrollments.push({
      id: "full", studentId: "s1", sessionId: "past", status: "ACTIVE", makeupForId: null, registrationId: null,
    });
    await expect(bookAsStaff("past")).resolves.toMatchObject({ status: "ACTIVE" });
  });

  it("allows a class that has since been made inactive", async () => {
    state.sessions.past.active = false;
    await expect(bookAsStaff("past")).resolves.toMatchObject({ sessionId: "past" });
  });

  it("leaves the attendance open when the teacher has not submitted that class", async () => {
    await bookAsStaff("past");
    // Locking one row would mark the whole class as submitted and lock the teacher out
    expect(state.recorded[0].lockedAt).toBeNull();
  });

  it("submits the attendance with the rest when the teacher already has", async () => {
    const when = new Date(Date.now() - 30 * 60 * 1000);
    state.submittedAt.past = when;
    await bookAsStaff("past");
    expect(state.recorded[0].lockedAt).toEqual(when);
  });

  it("still applies the other rules", async () => {
    state.attendance["att-1"].status = "PRESENT";
    await expect(bookAsStaff("past")).rejects.toThrow(/absent or excused/);
  });

  it("can be undone by staff, removing the attendance, but not by families", async () => {
    const makeup = await bookAsStaff("past");
    await expect(cancelMakeup({ enrollmentId: makeup.id, actorId: "parent-1" })).rejects.toThrow(
      /already taken place/
    );
    expect(state.recorded).toHaveLength(1);

    await cancelMakeup({ enrollmentId: makeup.id, actorId: "admin-1", allowPast: true });
    expect(state.recorded).toHaveLength(0);
    expect(state.enrollments.find((e) => e.id === makeup.id)).toMatchObject({
      status: "CANCELLED",
      makeupForId: null,
    });
    await expect(book("tap")).resolves.toMatchObject({ sessionId: "tap" });
  });
});

describe("cancelMakeup", () => {
  it("releases the spot and lets a different class be booked", async () => {
    const makeup = await book("jazz");
    await cancelMakeup({ enrollmentId: makeup.id, actorId: "parent-1" });
    expect(state.enrollments.find((e) => e.id === makeup.id)).toMatchObject({
      status: "CANCELLED",
      makeupForId: null,
    });
    await expect(book("tap")).resolves.toMatchObject({ sessionId: "tap", makeupForId: "att-1" });
    expect(state.audit).toEqual(["MAKEUP_BOOKED", "MAKEUP_CANCELLED", "MAKEUP_BOOKED"]);
  });

  it("refuses once the makeup class has taken place", async () => {
    const makeup = await book("jazz");
    state.sessions.jazz.startTime = new Date(Date.now() - HOUR);
    await expect(cancelMakeup({ enrollmentId: makeup.id, actorId: "p" })).rejects.toThrow(/already taken place/);
  });

  it("only cancels makeups, never an ordinary enrollment", async () => {
    await expect(cancelMakeup({ enrollmentId: "enr-ballet", actorId: "p" })).rejects.toThrow(/not found/);
    expect(state.enrollments[0].status).toBe("ACTIVE");
  });
});

describe("makeupState", () => {
  const now = new Date("2026-11-14T12:00:00Z");
  const base = { status: "ABSENT" as const, submitted: true, wasMakeup: false, makeup: null };

  it("offers a makeup for a submitted absence or excused absence", () => {
    expect(makeupState(base, now)).toBe("AVAILABLE");
    expect(makeupState({ ...base, status: "EXCUSED" }, now)).toBe("AVAILABLE");
  });

  it("offers nothing for attended classes or unsubmitted attendance", () => {
    expect(makeupState({ ...base, status: "PRESENT" }, now)).toBe("NONE");
    expect(makeupState({ ...base, status: "LATE" }, now)).toBe("NONE");
    expect(makeupState({ ...base, submitted: false }, now)).toBe("NONE");
  });

  it("is booked until the makeup class starts, then used", () => {
    expect(makeupState({ ...base, makeup: { startTime: "2026-11-20T17:00:00Z" } }, now)).toBe("BOOKED");
    expect(makeupState({ ...base, makeup: { startTime: "2026-11-10T17:00:00Z" } }, now)).toBe("USED");
  });

  it("does not offer a makeup for a missed makeup", () => {
    expect(makeupState({ ...base, wasMakeup: true }, now)).toBe("NOT_ELIGIBLE");
  });
});

describe("summarizeAttendance", () => {
  it("counts each status and the share attended", () => {
    const summary = summarizeAttendance([
      { status: "PRESENT", makeupState: "NONE" },
      { status: "PRESENT", makeupState: "NONE" },
      { status: "LATE", makeupState: "NONE" },
      { status: "ABSENT", makeupState: "AVAILABLE" },
      { status: "ABSENT", makeupState: "USED" },
      { status: "EXCUSED", makeupState: "BOOKED" },
    ]);
    expect(summary).toEqual({
      present: 2,
      late: 1,
      absent: 2,
      excused: 1,
      total: 6,
      attendedPercent: 50,
      makeupsAvailable: 1,
    });
  });

  it("has no percentage before any class is recorded", () => {
    expect(summarizeAttendance([]).attendedPercent).toBeNull();
  });
});
