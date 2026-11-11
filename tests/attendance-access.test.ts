import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ classSession: { findUnique: vi.fn(), findMany: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import {
  TEACHER_ATTENDANCE_DAYS_BACK,
  checkAttendanceAccess,
  getTeacherAttendanceSessions,
} from "@/lib/db/attendance";

const DAY = 24 * 60 * 60 * 1000;
const endOfToday = new Date(Date.now() + 6 * 60 * 60 * 1000);
const maria = { id: "user-maria", role: "TEACHER" };

function sessionAt(startTime: Date, teacherUserId = "user-maria") {
  db.classSession.findUnique.mockResolvedValue({ startTime, teacher: { userId: teacherUserId } });
}
const check = (user: { id: string; role: string }) => checkAttendanceAccess(user, "ses-1", endOfToday);

beforeEach(() => sessionAt(new Date(Date.now() - 60 * 60 * 1000)));

describe("checkAttendanceAccess", () => {
  it("lets an instructor mark their own class from today", async () => {
    expect(await check(maria)).toBe("ok");
  });

  it("lets an instructor mark a class later today", async () => {
    sessionAt(new Date(Date.now() + 2 * 60 * 60 * 1000));
    expect(await check(maria)).toBe("ok");
  });

  it("refuses another instructor's class", async () => {
    sessionAt(new Date(Date.now() - 60 * 60 * 1000), "user-james");
    expect(await check(maria)).toBe("forbidden");
  });

  it("refuses a class on a future day", async () => {
    sessionAt(new Date(endOfToday.getTime() + 60 * 1000));
    expect(await check(maria)).toBe("forbidden");
  });

  it("refuses a class older than the catch-up window", async () => {
    sessionAt(new Date(Date.now() - (TEACHER_ATTENDANCE_DAYS_BACK + 1) * DAY));
    expect(await check(maria)).toBe("forbidden");
    sessionAt(new Date(Date.now() - (TEACHER_ATTENDANCE_DAYS_BACK - 1) * DAY));
    expect(await check(maria)).toBe("ok");
  });

  it("lets admins mark any class, whenever it is", async () => {
    sessionAt(new Date(Date.now() - 200 * DAY), "user-james");
    expect(await check({ id: "user-admin", role: "ADMIN" })).toBe("ok");
    expect(await check({ id: "user-owner", role: "SUPER_ADMIN" })).toBe("ok");
  });

  it("never lets parents or students in, even without looking the class up", async () => {
    expect(await check({ id: "user-lisa", role: "PARENT" })).toBe("forbidden");
    expect(await check({ id: "user-alex", role: "STUDENT" })).toBe("forbidden");
    expect(db.classSession.findUnique).not.toHaveBeenCalled();
  });

  it("reports a class that does not exist", async () => {
    db.classSession.findUnique.mockResolvedValue(null);
    expect(await check(maria)).toBe("not-found");
    expect(await check({ id: "user-admin", role: "ADMIN" })).toBe("not-found");
  });
});

describe("getTeacherAttendanceSessions", () => {
  it("asks only for the instructor's own classes inside the window", async () => {
    db.classSession.findMany.mockResolvedValue([]);
    await getTeacherAttendanceSessions("user-maria", endOfToday);

    const { where, orderBy } = db.classSession.findMany.mock.calls[0][0];
    expect(where.teacher).toEqual({ userId: "user-maria" });
    expect(where.startTime.lte).toEqual(endOfToday);
    const daysBack = (Date.now() - where.startTime.gte.getTime()) / DAY;
    expect(daysBack).toBeCloseTo(TEACHER_ATTENDANCE_DAYS_BACK, 1);
    expect(orderBy).toEqual({ startTime: "desc" });
  });

  it("reports the roll size and whether attendance was already submitted", async () => {
    const base = {
      startTime: new Date(),
      endTime: new Date(),
      template: { name: "Ballet" },
      room: { name: "Studio A" },
    };
    db.classSession.findMany.mockResolvedValue([
      { id: "a", ...base, _count: { enrollments: 7 }, attendance: [{ id: "locked" }] },
      { id: "b", ...base, _count: { enrollments: 0 }, attendance: [] },
    ]);
    const sessions = await getTeacherAttendanceSessions("user-maria", endOfToday);
    expect(sessions.map((s) => [s.id, s.enrolled, s.submitted])).toEqual([
      ["a", 7, true],
      ["b", 0, false],
    ]);
  });
});
