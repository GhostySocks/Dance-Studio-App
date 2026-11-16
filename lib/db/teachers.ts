import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function getTeachers({
  search,
  page = 1,
  perPage = 10,
}: {
  search?: string;
  page?: number;
  perPage?: number;
}) {
  // Removed teachers keep their history but are no longer listed
  const where: Prisma.TeacherWhereInput = {
    user: {
      disabledAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
  };

  const [teachers, total] = await Promise.all([
    prisma.teacher.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        sessions: {
          where: {
            startTime: { gte: new Date() },
          },
          select: { id: true },
        },
      },
      orderBy: { user: { name: "asc" } },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.teacher.count({ where }),
  ]);

  return { teachers, total, totalPages: Math.ceil(total / perPage) };
}

export async function getTeacherById(id: string) {
  return prisma.teacher.findFirst({
    where: { id, user: { disabledAt: null } },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      sessions: {
        include: {
          template: { select: { name: true, danceStyle: true } },
          room: { select: { name: true } },
          enrollments: { select: { id: true } },
        },
        orderBy: { startTime: "desc" },
        take: 20,
      },
    },
  });
}

export async function updateTeacher(
  id: string,
  data: {
    bio?: string | null;
    specialties?: string[];
    phone?: string | null;
  }
) {
  return prisma.teacher.update({ where: { id }, data });
}

/**
 * A teacher's own profile with their upcoming classes and who is in each one.
 * Students are returned by name only, with whether they are waitlisted or there
 * on a makeup; cancelled bookings are left out.
 */
export async function getTeacherUpcomingClasses(userId: string) {
  return prisma.teacher.findUnique({
    where: { userId },
    select: {
      id: true,
      user: { select: { id: true, name: true, email: true, image: true } },
      sessions: {
        where: { startTime: { gte: new Date() } },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          maxCapacity: true,
          template: { select: { name: true, danceStyle: true } },
          room: { select: { name: true } },
          // Set when this teacher is covering the date for someone else
          substituteFor: { select: { user: { select: { name: true } } } },
          enrollments: {
            where: { status: { in: ["ACTIVE", "WAITLIST"] } },
            select: {
              id: true,
              status: true,
              makeupForId: true,
              student: { select: { firstName: true, lastName: true } },
            },
            orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
          },
        },
        orderBy: { startTime: "asc" },
      },
    },
  });
}

/** Current teachers by name, for pick-lists. Removed (disabled) teachers are left out. */
export async function getTeacherOptions(): Promise<{ id: string; name: string }[]> {
  const teachers = await prisma.teacher.findMany({
    where: { user: { disabledAt: null } },
    select: { id: true, user: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return teachers.map((teacher) => ({ id: teacher.id, name: teacher.user.name ?? "Teacher" }));
}
