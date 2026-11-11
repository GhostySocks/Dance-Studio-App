import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function getStudents({
  search,
  page = 1,
  perPage = 10,
}: {
  search?: string;
  page?: number;
  perPage?: number;
}) {
  const where: Prisma.StudentWhereInput = search
    ? {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: {
        familyGroup: { select: { id: true, name: true } },
        guardian: {
          select: {
            id: true,
            user: { select: { name: true, email: true } },
          },
        },
        enrollments: {
          where: { status: "ACTIVE" },
          select: { id: true },
        },
      },
      orderBy: { lastName: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.student.count({ where }),
  ]);

  return { students, total, totalPages: Math.ceil(total / perPage) };
}

export async function getStudentById(id: string) {
  return prisma.student.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, name: true, role: true } },
      familyGroup: { select: { id: true, name: true } },
      guardian: {
        select: {
          id: true,
          phone: true,
          address: true,
          user: { select: { name: true, email: true } },
        },
      },
      enrollments: {
        include: {
          session: {
            include: {
              template: { select: { name: true, danceStyle: true, basePriceCents: true } },
              teacher: { select: { user: { select: { name: true } } } },
              room: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      scholarships: true,
      invoices: {
        select: { id: true, status: true, totalCents: true, periodStart: true, periodEnd: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
}

export async function createStudent(data: {
  firstName: string;
  lastName: string;
  dateOfBirth?: Date | null;
  email?: string | null;
  phone?: string | null;
  medicalNotes?: string | null;
  notes?: string | null;
  guardianId?: string | null;
  familyGroupId?: string | null;
}) {
  return prisma.student.create({ data });
}

export async function updateStudent(
  id: string,
  data: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: Date | null;
    email?: string | null;
    phone?: string | null;
    medicalNotes?: string | null;
    notes?: string | null;
    guardianId?: string | null;
    familyGroupId?: string | null;
  }
) {
  return prisma.student.update({ where: { id }, data });
}

export async function deleteStudent(id: string) {
  return prisma.student.delete({ where: { id } });
}

/** Names for a set of student ids (used to confirm they exist). */
export async function getStudentNames(ids: string[]) {
  return prisma.student.findMany({
    where: { id: { in: ids } },
    select: { id: true, firstName: true, lastName: true },
  });
}
