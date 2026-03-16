import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function getClassTemplates({
  search,
  page = 1,
  perPage = 10,
}: {
  search?: string;
  page?: number;
  perPage?: number;
}) {
  const where: Prisma.ClassTemplateWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { danceStyle: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const [templates, total] = await Promise.all([
    prisma.classTemplate.findMany({
      where,
      include: {
        sessions: {
          where: { startTime: { gte: new Date() } },
          select: { id: true },
        },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.classTemplate.count({ where }),
  ]);

  return { templates, total, totalPages: Math.ceil(total / perPage) };
}

export async function getAllClassTemplates() {
  return prisma.classTemplate.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function getClassTemplateById(id: string) {
  return prisma.classTemplate.findUnique({
    where: { id },
    include: {
      sessions: {
        include: {
          teacher: { select: { id: true, user: { select: { name: true } } } },
          room: { select: { id: true, name: true } },
          enrollments: { where: { status: "ACTIVE" }, select: { id: true } },
        },
        orderBy: { startTime: "desc" },
      },
    },
  });
}

export async function createClassTemplate(data: {
  name: string;
  description?: string | null;
  danceStyle?: string | null;
  skillLevel?: string | null;
  defaultDurationMins: number;
  basePriceCents: number;
}) {
  return prisma.classTemplate.create({ data });
}

export async function updateClassTemplate(id: string, data: {
  name?: string;
  description?: string | null;
  danceStyle?: string | null;
  skillLevel?: string | null;
  defaultDurationMins?: number;
  basePriceCents?: number;
  isActive?: boolean;
}) {
  return prisma.classTemplate.update({ where: { id }, data });
}

export async function deleteClassTemplate(id: string) {
  return prisma.classTemplate.delete({ where: { id } });
}

// ─── Class Sessions ──────────────────────────────────────────────────────────

export async function getClassSessions({
  startDate,
  endDate,
  teacherId,
  roomId,
}: {
  startDate?: Date;
  endDate?: Date;
  teacherId?: string;
  roomId?: string;
}) {
  const where: Prisma.ClassSessionWhereInput = {};
  if (startDate && endDate) {
    where.startTime = { gte: startDate };
    where.endTime = { lte: endDate };
  }
  if (teacherId) where.teacherId = teacherId;
  if (roomId) where.roomId = roomId;

  return prisma.classSession.findMany({
    where,
    include: {
      template: { select: { name: true, danceStyle: true, basePriceCents: true } },
      teacher: { select: { id: true, user: { select: { name: true } } } },
      room: { select: { id: true, name: true } },
      enrollments: { where: { status: "ACTIVE" }, select: { id: true } },
    },
    orderBy: { startTime: "asc" },
  });
}

export async function getClassSessionById(id: string) {
  return prisma.classSession.findUnique({
    where: { id },
    include: {
      template: true,
      teacher: { select: { id: true, user: { select: { name: true, email: true } } } },
      room: true,
      enrollments: {
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });
}

export async function createClassSession(data: {
  templateId: string;
  teacherId: string;
  roomId: string;
  startTime: Date;
  endTime: Date;
  maxCapacity: number;
  isRecurring?: boolean;
  notes?: string | null;
}) {
  return prisma.classSession.create({ data });
}

export async function updateClassSession(id: string, data: {
  templateId?: string;
  teacherId?: string;
  roomId?: string;
  startTime?: Date;
  endTime?: Date;
  maxCapacity?: number;
  notes?: string | null;
}) {
  return prisma.classSession.update({ where: { id }, data });
}

export async function deleteClassSession(id: string) {
  return prisma.classSession.delete({ where: { id } });
}

export async function createRecurringSessions(data: {
  templateId: string;
  teacherId: string;
  roomId: string;
  startTime: Date;
  endTime: Date;
  maxCapacity: number;
  weekCount: number;
}) {
  const sessions = [];
  for (let i = 0; i < data.weekCount; i++) {
    const start = new Date(data.startTime);
    start.setDate(start.getDate() + i * 7);
    const end = new Date(data.endTime);
    end.setDate(end.getDate() + i * 7);
    sessions.push({
      templateId: data.templateId,
      teacherId: data.teacherId,
      roomId: data.roomId,
      startTime: start,
      endTime: end,
      maxCapacity: data.maxCapacity,
      isRecurring: true,
    });
  }
  return prisma.classSession.createMany({ data: sessions });
}
