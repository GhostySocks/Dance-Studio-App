import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function getEnrollments({
  sessionId,
  studentId,
  status,
  search,
  page = 1,
  perPage = 20,
}: {
  sessionId?: string;
  studentId?: string;
  status?: string;
  search?: string;
  page?: number;
  perPage?: number;
}) {
  const where: Prisma.EnrollmentWhereInput = {};
  if (sessionId) where.sessionId = sessionId;
  if (studentId) where.studentId = studentId;
  if (status) where.status = status as Prisma.EnumEnrollmentStatusFilter;

  if (search) {
    where.student = {
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
      ],
    };
  }

  const [enrollments, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        session: {
          include: {
            template: { select: { name: true, danceStyle: true, basePriceCents: true } },
            teacher: { select: { user: { select: { name: true } } } },
            room: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.enrollment.count({ where }),
  ]);

  return { enrollments, total, totalPages: Math.ceil(total / perPage) };
}

export async function getEnrollmentById(id: string) {
  return prisma.enrollment.findUnique({
    where: { id },
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      session: {
        include: {
          template: { select: { name: true, danceStyle: true, basePriceCents: true } },
          teacher: { select: { user: { select: { name: true } } } },
          room: { select: { name: true } },
        },
      },
    },
  });
}

export async function enrollStudent({
  studentId,
  sessionId,
  force = false,
}: {
  studentId: string;
  sessionId: string;
  force?: boolean;
}): Promise<{
  success: boolean;
  enrollment?: Awaited<ReturnType<typeof prisma.enrollment.create>>;
  waitlist?: boolean;
  error?: string;
}> {
  // Lock the session row so two people cannot take the last spot at the same time
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "ClassSession" WHERE id = ${sessionId} FOR UPDATE`;
    if (locked.length === 0) return { success: false, error: "Session not found" };

    // Check if already enrolled
    const existing = await tx.enrollment.findUnique({
      where: { studentId_sessionId: { studentId, sessionId } },
    });

    if (existing) {
      if (existing.status === "ACTIVE") {
        return { success: false, error: "Student is already enrolled in this session" };
      }
      if (existing.status === "WAITLIST") {
        return { success: false, error: "Student is already on the waitlist for this session" };
      }
      // Re-enroll a cancelled student
      const session = await tx.classSession.findUnique({
        where: { id: sessionId },
        select: { maxCapacity: true },
      });
      if (!session) return { success: false, error: "Session not found" };

      const activeCount = await tx.enrollment.count({
        where: { sessionId, status: "ACTIVE" },
      });

      const newStatus = activeCount >= session.maxCapacity && !force ? "WAITLIST" : "ACTIVE";
      const enrollment = await tx.enrollment.update({
        where: { id: existing.id },
        data: { status: newStatus },
      });
      return { success: true, enrollment, waitlist: newStatus === "WAITLIST" };
    }

    // Fetch session capacity
    const session = await tx.classSession.findUnique({
      where: { id: sessionId },
      select: { maxCapacity: true },
    });

    if (!session) return { success: false, error: "Session not found" };

    const activeCount = await tx.enrollment.count({
      where: { sessionId, status: "ACTIVE" },
    });

    if (activeCount >= session.maxCapacity && !force) {
      // Auto-waitlist
      const enrollment = await tx.enrollment.create({
        data: { studentId, sessionId, status: "WAITLIST" },
      });
      return { success: true, enrollment, waitlist: true };
    }

    const enrollment = await tx.enrollment.create({
      data: { studentId, sessionId, status: "ACTIVE" },
    });
    return { success: true, enrollment, waitlist: false };
  });
}

export async function bulkEnrollStudents({
  studentIds,
  sessionId,
  force = false,
}: {
  studentIds: string[];
  sessionId: string;
  force?: boolean;
}) {
  const results = [];
  for (const studentId of studentIds) {
    const result = await enrollStudent({ studentId, sessionId, force });
    results.push({ studentId, ...result });
  }
  return results;
}

export async function updateEnrollmentStatus(
  id: string,
  status: "ACTIVE" | "WAITLIST" | "CANCELLED"
) {
  return prisma.enrollment.update({
    where: { id },
    data: { status },
  });
}

export async function cancelEnrollment(id: string) {
  const enrollment = await prisma.enrollment.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  // Check if there's a waitlisted student to promote
  const nextWaitlisted = await prisma.enrollment.findFirst({
    where: { sessionId: enrollment.sessionId, status: "WAITLIST" },
    orderBy: { createdAt: "asc" },
  });

  if (nextWaitlisted) {
    const session = await prisma.classSession.findUnique({
      where: { id: enrollment.sessionId },
      select: { maxCapacity: true },
    });
    const activeCount = await prisma.enrollment.count({
      where: { sessionId: enrollment.sessionId, status: "ACTIVE" },
    });

    if (session && activeCount < session.maxCapacity) {
      await prisma.enrollment.update({
        where: { id: nextWaitlisted.id },
        data: { status: "ACTIVE" },
      });
      return { cancelled: enrollment, promoted: nextWaitlisted };
    }
  }

  return { cancelled: enrollment, promoted: null };
}

export async function deleteEnrollment(id: string) {
  return prisma.enrollment.delete({ where: { id } });
}

export async function getSessionEnrollmentStats(sessionId: string) {
  const [active, waitlist, total, session] = await Promise.all([
    prisma.enrollment.count({ where: { sessionId, status: "ACTIVE" } }),
    prisma.enrollment.count({ where: { sessionId, status: "WAITLIST" } }),
    prisma.enrollment.count({ where: { sessionId } }),
    prisma.classSession.findUnique({
      where: { id: sessionId },
      select: { maxCapacity: true },
    }),
  ]);

  return {
    active,
    waitlist,
    total,
    maxCapacity: session?.maxCapacity ?? 0,
    isFull: session ? active >= session.maxCapacity : false,
  };
}
