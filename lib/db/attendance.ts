import { prisma } from "@/lib/prisma";

export async function getSessionAttendance(sessionId: string) {
  return prisma.attendance.findMany({
    where: { sessionId },
    include: {
      enrollment: {
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
    },
    orderBy: { enrollment: { student: { lastName: "asc" } } },
  });
}

export async function getOrCreateSessionAttendance(sessionId: string) {
  // Get all active enrollments for this session
  const enrollments = await prisma.enrollment.findMany({
    where: { sessionId, status: "ACTIVE" },
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
    orderBy: { student: { lastName: "asc" } },
  });

  // Get existing attendance records
  const existing = await prisma.attendance.findMany({
    where: { sessionId },
    select: { enrollmentId: true },
  });
  const existingIds = new Set(existing.map((a) => a.enrollmentId));

  // Create missing records (default to ABSENT)
  const missing = enrollments.filter((e) => !existingIds.has(e.id));
  if (missing.length > 0) {
    await prisma.attendance.createMany({
      data: missing.map((e) => ({
        enrollmentId: e.id,
        sessionId,
        status: "ABSENT" as const,
      })),
      skipDuplicates: true,
    });
  }

  // Return all attendance records
  return prisma.attendance.findMany({
    where: { sessionId },
    include: {
      enrollment: {
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
    },
    orderBy: { enrollment: { student: { lastName: "asc" } } },
  });
}

export async function markAttendance({
  enrollmentId,
  sessionId,
  status,
  notes,
}: {
  enrollmentId: string;
  sessionId: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  notes?: string;
}) {
  // Check if locked
  const existing = await prisma.attendance.findUnique({
    where: { enrollmentId_sessionId: { enrollmentId, sessionId } },
    select: { lockedAt: true },
  });

  if (existing?.lockedAt) {
    return { success: false, error: "Attendance is locked and cannot be modified" };
  }

  const record = await prisma.attendance.upsert({
    where: { enrollmentId_sessionId: { enrollmentId, sessionId } },
    create: { enrollmentId, sessionId, status, notes },
    update: { status, notes },
  });

  return { success: true, record };
}

export async function batchMarkAttendance({
  sessionId,
  records,
}: {
  sessionId: string;
  records: Array<{
    enrollmentId: string;
    status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
    notes?: string;
  }>;
}) {
  // Check if any are locked
  const locked = await prisma.attendance.findFirst({
    where: { sessionId, lockedAt: { not: null } },
  });

  if (locked) {
    return { success: false, error: "Attendance for this session is locked" };
  }

  const results = [];
  for (const record of records) {
    const result = await prisma.attendance.upsert({
      where: {
        enrollmentId_sessionId: {
          enrollmentId: record.enrollmentId,
          sessionId,
        },
      },
      create: {
        enrollmentId: record.enrollmentId,
        sessionId,
        status: record.status,
        notes: record.notes,
      },
      update: {
        status: record.status,
        notes: record.notes,
      },
    });
    results.push(result);
  }

  return { success: true, records: results };
}

export async function submitAttendance(sessionId: string, actorId: string) {
  const now = new Date();

  // Lock all attendance records for this session
  await prisma.attendance.updateMany({
    where: { sessionId, lockedAt: null },
    data: { lockedAt: now },
  });

  // Write audit log
  await prisma.auditLog.create({
    data: {
      actorId,
      action: "ATTENDANCE_LOCKED",
      entityType: "ClassSession",
      entityId: sessionId,
      meta: { lockedAt: now.toISOString() },
    },
  });

  return { success: true, lockedAt: now };
}

export async function unlockAttendance(sessionId: string, actorId: string) {
  await prisma.attendance.updateMany({
    where: { sessionId },
    data: { lockedAt: null },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "ATTENDANCE_UNLOCKED",
      entityType: "ClassSession",
      entityId: sessionId,
      meta: { unlockedAt: new Date().toISOString() },
    },
  });

  return { success: true };
}

export async function isAttendanceLocked(sessionId: string) {
  const locked = await prisma.attendance.findFirst({
    where: { sessionId, lockedAt: { not: null } },
    select: { lockedAt: true },
  });
  return !!locked;
}

export async function getAttendanceReport({
  startDate,
  endDate,
  teacherId,
}: {
  startDate?: Date;
  endDate?: Date;
  teacherId?: string;
}) {
  const where: {
    session?: {
      startTime?: { gte?: Date; lte?: Date };
      teacherId?: string;
    };
  } = {};

  if (startDate || endDate || teacherId) {
    where.session = {};
    if (startDate) where.session.startTime = { gte: startDate };
    if (endDate) {
      where.session.startTime = {
        ...where.session.startTime,
        lte: endDate,
      };
    }
    if (teacherId) where.session.teacherId = teacherId;
  }

  const records = await prisma.attendance.findMany({
    where,
    include: {
      enrollment: {
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
      session: {
        include: {
          template: { select: { name: true, danceStyle: true } },
          teacher: { select: { user: { select: { name: true } } } },
        },
      },
    },
    orderBy: { session: { startTime: "desc" } },
  });

  // Compute summary stats
  const total = records.length;
  const present = records.filter((r) => r.status === "PRESENT").length;
  const absent = records.filter((r) => r.status === "ABSENT").length;
  const late = records.filter((r) => r.status === "LATE").length;
  const excused = records.filter((r) => r.status === "EXCUSED").length;

  return {
    records,
    summary: {
      total,
      present,
      absent,
      late,
      excused,
      attendanceRate: total > 0 ? Math.round(((present + late) / total) * 100) : 0,
    },
  };
}

// ─── Who may take attendance for which class ─────────────────────────────────

/** Instructors can mark classes from the last two weeks up to the end of today. */
export const TEACHER_ATTENDANCE_DAYS_BACK = 14;

function teacherWindow(endOfToday: Date) {
  return {
    gte: new Date(Date.now() - TEACHER_ATTENDANCE_DAYS_BACK * 24 * 60 * 60 * 1000),
    lte: endOfToday,
  };
}

/**
 * The classes an instructor can take attendance for right now: their own, from
 * the last two weeks through the end of today (studio time), newest first.
 */
export async function getTeacherAttendanceSessions(userId: string, endOfToday: Date) {
  const sessions = await prisma.classSession.findMany({
    where: { teacher: { userId }, startTime: teacherWindow(endOfToday) },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      template: { select: { name: true } },
      room: { select: { name: true } },
      _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
      attendance: { where: { lockedAt: { not: null } }, select: { id: true }, take: 1 },
    },
    orderBy: { startTime: "desc" },
  });

  return sessions.map(({ _count, attendance, ...session }) => ({
    ...session,
    enrolled: _count.enrollments,
    submitted: attendance.length > 0,
  }));
}

/**
 * Whether this user may view and mark attendance for a class. Admins: any class.
 * Instructors: only classes they teach, and only inside the attendance window
 * (not future days, not older than two weeks). Everyone else: never.
 */
export async function checkAttendanceAccess(
  user: { id: string; role: string },
  sessionId: string,
  endOfToday: Date
): Promise<"ok" | "forbidden" | "not-found"> {
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  if (!isAdmin && user.role !== "TEACHER") return "forbidden";

  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: { startTime: true, teacher: { select: { userId: true } } },
  });
  if (!session) return "not-found";
  if (isAdmin) return "ok";

  if (session.teacher.userId !== user.id) return "forbidden";
  const window = teacherWindow(endOfToday);
  return session.startTime >= window.gte && session.startTime <= window.lte ? "ok" : "forbidden";
}
