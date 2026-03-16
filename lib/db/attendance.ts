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
