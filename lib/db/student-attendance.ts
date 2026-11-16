import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  isMissed,
  makeupState,
  summarizeAttendance,
  type AttendanceSummary,
  type MakeupState,
} from "@/lib/makeups";

/** A problem the person can act on; the message is safe to show. */
export class MakeupError extends Error {}

/** Students a portal user may see: a guardian's children, or the adult student themself. */
function ownStudents(userId: string): Prisma.StudentWhereInput {
  return { OR: [{ guardian: { userId } }, { userId }] };
}

/** Whether this parent or adult student is linked to the student. */
export async function userOwnsStudent(userId: string, studentId: string): Promise<boolean> {
  const student = await prisma.student.findFirst({
    where: { id: studentId, ...ownStudents(userId) },
    select: { id: true },
  });
  return student !== null;
}

// The teacher is selected by name only: a teacher's email must never reach a family's browser
const sessionSummary = {
  id: true,
  startTime: true,
  endTime: true,
  template: { select: { name: true, danceStyle: true } },
  teacher: { select: { user: { select: { name: true } } } },
} satisfies Prisma.ClassSessionSelect;

const attendanceSelect = {
  id: true,
  status: true,
  notes: true,
  session: { select: sessionSummary },
  enrollment: { select: { makeupForId: true } },
  makeup: { select: { id: true, status: true, session: { select: sessionSummary } } },
} satisfies Prisma.AttendanceSelect;

type AttendanceRow = Prisma.AttendanceGetPayload<{ select: typeof attendanceSelect }>;
type SessionRow = AttendanceRow["session"];

export interface AttendanceClass {
  sessionId: string;
  className: string;
  danceStyle: string | null;
  teacherName: string | null;
  startTime: string;
  endTime: string;
}

export interface StudentAttendanceRecord {
  id: string;
  status: AttendanceRow["status"];
  /** The class attended (or missed) was itself a makeup for an earlier absence */
  wasMakeup: boolean;
  class: AttendanceClass;
  makeupState: MakeupState;
  /** The makeup class booked for this absence */
  makeup: ({ enrollmentId: string } & AttendanceClass) | null;
}

export interface StudentAttendance {
  student: { id: string; firstName: string; lastName: string };
  summary: AttendanceSummary;
  records: StudentAttendanceRecord[];
}

function toClass(session: SessionRow): AttendanceClass {
  return {
    sessionId: session.id,
    className: session.template.name,
    danceStyle: session.template.danceStyle,
    teacherName: session.teacher.user.name,
    startTime: session.startTime.toISOString(),
    endTime: session.endTime.toISOString(),
  };
}

function toRecord(row: AttendanceRow, now: Date): StudentAttendanceRecord {
  const makeup = row.makeup && row.makeup.status === "ACTIVE" ? row.makeup : null;
  const wasMakeup = row.enrollment.makeupForId !== null;
  return {
    id: row.id,
    status: row.status,
    wasMakeup,
    class: toClass(row.session),
    makeupState: makeupState(
      {
        status: row.status,
        submitted: true,
        wasMakeup,
        makeup: makeup ? { startTime: makeup.session.startTime } : null,
      },
      now
    ),
    makeup: makeup ? { enrollmentId: makeup.id, ...toClass(makeup.session) } : null,
  };
}

/**
 * Attendance history for a set of students, newest class first. Only attendance
 * the teacher has submitted is included: until then every student is recorded as
 * absent by default, which must not be shown as a real absence.
 */
async function loadAttendance(where: Prisma.StudentWhereInput): Promise<StudentAttendance[]> {
  const now = new Date();
  const [students, rows] = await Promise.all([
    prisma.student.findMany({
      where,
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.attendance.findMany({
      where: { lockedAt: { not: null }, enrollment: { student: where } },
      select: { ...attendanceSelect, enrollment: { select: { makeupForId: true, studentId: true } } },
      orderBy: { session: { startTime: "desc" } },
    }),
  ]);

  // Group in memory rather than querying once per student
  const byStudent = new Map<string, StudentAttendanceRecord[]>();
  for (const row of rows) {
    const list = byStudent.get(row.enrollment.studentId) ?? [];
    list.push(toRecord(row, now));
    byStudent.set(row.enrollment.studentId, list);
  }

  return students.map((student) => {
    const records = byStudent.get(student.id) ?? [];
    return { student, summary: summarizeAttendance(records), records };
  });
}

/** One student's attendance (admin view). Null if the student does not exist. */
export async function getStudentAttendance(studentId: string): Promise<StudentAttendance | null> {
  const [result] = await loadAttendance({ id: studentId });
  return result ?? null;
}

/** Attendance for every student linked to a parent or adult-student account. */
export function getOwnAttendance(userId: string): Promise<StudentAttendance[]> {
  return loadAttendance(ownStudents(userId));
}

export interface MakeupOption extends AttendanceClass {
  roomName: string;
  skillLevel: string | null;
  spotsLeft: number;
}

/** How far ahead, and how far back, classes are offered as makeups. */
export const MAKEUP_LOOKAHEAD_DAYS = 56;
export const MAKEUP_LOOKBACK_DAYS = 56;

/**
 * Classes this student could count as a makeup, leaving out any they are already
 * booked into.
 *  - "upcoming": active classes with a free spot, soonest first.
 *  - "past": classes that have already taken place, most recent first, for when
 *    the student turned up to a class they were not booked into. Staff only (the
 *    route checks); spots do not matter because the class has happened.
 */
export async function getMakeupOptions(
  studentId: string,
  when: "upcoming" | "past" = "upcoming"
): Promise<MakeupOption[]> {
  const now = new Date();
  const DAY = 24 * 60 * 60 * 1000;
  const past = when === "past";
  const sessions = await prisma.classSession.findMany({
    where: {
      startTime: past
        ? { lte: now, gte: new Date(now.getTime() - MAKEUP_LOOKBACK_DAYS * DAY) }
        : { gt: now, lte: new Date(now.getTime() + MAKEUP_LOOKAHEAD_DAYS * DAY) },
      // A class that has since been retired can still have been attended
      ...(past ? {} : { template: { isActive: true } }),
      enrollments: { none: { studentId, status: { in: ["ACTIVE", "WAITLIST"] } } },
    },
    select: {
      ...sessionSummary,
      maxCapacity: true,
      template: { select: { name: true, danceStyle: true, skillLevel: true } },
      room: { select: { name: true } },
      _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
    },
    orderBy: { startTime: past ? "desc" : "asc" },
  });

  return sessions
    .map((session) => ({
      ...toClass(session),
      roomName: session.room.name,
      skillLevel: session.template.skillLevel,
      spotsLeft: session.maxCapacity - session._count.enrollments,
    }))
    .filter((option) => past || option.spotsLeft > 0);
}

/** The student an attendance record or a makeup enrollment belongs to (for access checks). */
export async function getAttendanceStudentId(attendanceId: string): Promise<string | null> {
  const row = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    select: { enrollment: { select: { studentId: true } } },
  });
  return row?.enrollment.studentId ?? null;
}

export async function getMakeupStudentId(enrollmentId: string): Promise<string | null> {
  const row = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, makeupForId: { not: null } },
    select: { studentId: true },
  });
  return row?.studentId ?? null;
}

/**
 * Books a makeup class for a missed class. Runs in a transaction that locks the
 * class row, like `enrollStudent`, so the last spot cannot be taken twice. A
 * makeup only ever takes a free spot: it is never waitlisted and never forced.
 *
 * With `allowPast` (staff only) the class may be one that has already taken
 * place: the student turned up to it without being booked. Capacity is not
 * checked, and the student is marked present in that class.
 */
export async function bookMakeup({
  attendanceId,
  sessionId,
  actorId,
  allowPast = false,
}: {
  attendanceId: string;
  sessionId: string;
  actorId: string;
  allowPast?: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "ClassSession" WHERE id = ${sessionId} FOR UPDATE`;
    if (locked.length === 0) throw new MakeupError("That class is no longer available");

    const [missed, target] = await Promise.all([
      tx.attendance.findUnique({
        where: { id: attendanceId },
        select: {
          status: true,
          lockedAt: true,
          sessionId: true,
          enrollment: { select: { studentId: true, makeupForId: true } },
          makeup: { select: { id: true, status: true } },
        },
      }),
      tx.classSession.findUnique({
        where: { id: sessionId },
        select: {
          startTime: true,
          maxCapacity: true,
          template: { select: { isActive: true } },
          _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
        },
      }),
    ]);

    if (!missed) throw new MakeupError("That class record was not found");
    if (!missed.lockedAt || !isMissed(missed.status)) {
      throw new MakeupError("Only a class marked absent or excused can be made up");
    }
    if (missed.enrollment.makeupForId) {
      throw new MakeupError("A missed makeup class cannot be made up again");
    }
    if (missed.makeup && missed.makeup.status === "ACTIVE") {
      throw new MakeupError("A makeup is already booked for this class");
    }
    if (!target) throw new MakeupError("That class is no longer available");
    const isPast = target.startTime.getTime() <= Date.now();
    if (isPast ? !allowPast : !target.template.isActive) {
      throw new MakeupError("That class is no longer available");
    }

    const studentId = missed.enrollment.studentId;
    const existing = await tx.enrollment.findUnique({
      where: { studentId_sessionId: { studentId, sessionId } },
      select: { id: true, status: true },
    });
    if (existing && existing.status !== "CANCELLED") {
      throw new MakeupError("The student is already booked into that class");
    }
    if (!isPast && target._count.enrollments >= target.maxCapacity) {
      throw new MakeupError("That class is now full. Please choose another.");
    }

    // A cancelled makeup keeps no link to the absence (see cancelMakeup), but an old
    // cancelled one from before that rule could; release it so the link is free
    if (missed.makeup) {
      await tx.enrollment.update({ where: { id: missed.makeup.id }, data: { makeupForId: null } });
    }

    const data = { status: "ACTIVE" as const, makeupForId: attendanceId, registrationId: null };
    const enrollment = existing
      ? await tx.enrollment.update({ where: { id: existing.id }, data })
      : await tx.enrollment.create({ data: { studentId, sessionId, ...data } });

    if (isPast) {
      // The student was there, so record it. If the teacher has already submitted
      // that class, this record is submitted with it; otherwise it stays open like
      // the rest of the roster (locking one row would lock the teacher out).
      const submitted = await tx.attendance.findFirst({
        where: { sessionId, lockedAt: { not: null } },
        select: { lockedAt: true },
      });
      await tx.attendance.upsert({
        where: { enrollmentId_sessionId: { enrollmentId: enrollment.id, sessionId } },
        create: {
          enrollmentId: enrollment.id,
          sessionId,
          status: "PRESENT",
          lockedAt: submitted?.lockedAt ?? null,
          notes: "Attended as a makeup (recorded afterwards)",
        },
        update: { status: "PRESENT" },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId,
        action: "MAKEUP_BOOKED",
        entityType: "Enrollment",
        entityId: enrollment.id,
        meta: {
          studentId,
          missedSessionId: missed.sessionId,
          makeupSessionId: sessionId,
          recordedAfterwards: isPast,
        },
      },
    });
    return enrollment;
  });
}

/**
 * Cancels a makeup that has not happened yet. The spot is released and the
 * absence can be made up with a different class. With `allowPast` (staff only)
 * a makeup whose class has already taken place can be undone too, which also
 * removes the attendance recorded for it.
 */
export async function cancelMakeup({
  enrollmentId,
  actorId,
  allowPast = false,
}: {
  enrollmentId: string;
  actorId: string;
  allowPast?: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const makeup = await tx.enrollment.findUnique({
      where: { id: enrollmentId },
      select: {
        status: true,
        makeupForId: true,
        studentId: true,
        session: { select: { id: true, startTime: true } },
      },
    });
    if (!makeup || !makeup.makeupForId) throw new MakeupError("That makeup was not found");
    if (makeup.status !== "ACTIVE") throw new MakeupError("That makeup is already cancelled");
    const isPast = makeup.session.startTime.getTime() <= Date.now();
    if (isPast && !allowPast) throw new MakeupError("That class has already taken place");
    if (isPast) await tx.attendance.deleteMany({ where: { enrollmentId } });

    const cancelled = await tx.enrollment.update({
      where: { id: enrollmentId },
      data: { status: "CANCELLED", makeupForId: null },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: "MAKEUP_CANCELLED",
        entityType: "Enrollment",
        entityId: enrollmentId,
        meta: { studentId: makeup.studentId, makeupSessionId: makeup.session.id },
      },
    });
    return cancelled;
  });
}
