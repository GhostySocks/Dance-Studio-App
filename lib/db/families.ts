import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function getFamilyGroups({
  search,
  page = 1,
  perPage = 10,
}: {
  search?: string;
  page?: number;
  perPage?: number;
}) {
  const where: Prisma.FamilyGroupWhereInput = search
    ? { name: { contains: search, mode: "insensitive" } }
    : {};

  const [families, total] = await Promise.all([
    prisma.familyGroup.findMany({
      where,
      include: {
        students: { select: { id: true, firstName: true, lastName: true } },
        guardians: {
          include: {
            guardian: {
              select: {
                id: true,
                user: { select: { name: true, email: true } },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.familyGroup.count({ where }),
  ]);

  return { families, total, totalPages: Math.ceil(total / perPage) };
}

export async function getFamilyGroupById(id: string) {
  return prisma.familyGroup.findUnique({
    where: { id },
    include: {
      students: {
        include: {
          enrollments: {
            where: { status: "ACTIVE" },
            include: {
              session: {
                include: {
                  template: { select: { name: true, danceStyle: true, basePriceCents: true } },
                },
              },
            },
          },
        },
      },
      guardians: {
        include: {
          guardian: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
      invoices: {
        select: { id: true, status: true, totalCents: true, periodStart: true, periodEnd: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      scholarships: true,
      pricingRules: true,
    },
  });
}

export async function createFamilyGroup(data: { name: string }) {
  return prisma.familyGroup.create({ data });
}

export async function updateFamilyGroup(id: string, data: { name: string }) {
  return prisma.familyGroup.update({ where: { id }, data });
}

export async function deleteFamilyGroup(id: string) {
  return prisma.familyGroup.delete({ where: { id } });
}

export async function addGuardianToFamily(familyGroupId: string, guardianId: string) {
  return prisma.familyGroupGuardian.create({
    data: { familyGroupId, guardianId },
  });
}

export async function removeGuardianFromFamily(familyGroupId: string, guardianId: string) {
  return prisma.familyGroupGuardian.delete({
    where: {
      familyGroupId_guardianId: { familyGroupId, guardianId },
    },
  });
}

export async function getGuardians() {
  return prisma.guardian.findMany({
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { user: { name: "asc" } },
  });
}
