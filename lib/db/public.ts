import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Read-only queries for the public website and the embeddable widget.
 * Nothing here may return student, family or enrollment records — only counts.
 */

const publicSessionSelect = {
  id: true,
  startTime: true,
  endTime: true,
  maxCapacity: true,
  template: {
    select: {
      id: true,
      name: true,
      danceStyle: true,
      skillLevel: true,
      basePriceCents: true,
      dropInEnabled: true,
    },
  },
  teacher: { select: { user: { select: { name: true } } } },
  room: { select: { name: true } },
  _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
} satisfies Prisma.ClassSessionSelect;

type PublicSessionRow = Prisma.ClassSessionGetPayload<{ select: typeof publicSessionSelect }>;

export interface PublicSession {
  id: string;
  startTime: string;
  endTime: string;
  spotsLeft: number;
  template: PublicSessionRow["template"];
  teacherName: string;
  roomName: string;
}

function toPublicSession(row: PublicSessionRow): PublicSession {
  return {
    id: row.id,
    startTime: row.startTime.toISOString(),
    endTime: row.endTime.toISOString(),
    spotsLeft: Math.max(row.maxCapacity - row._count.enrollments, 0),
    template: row.template,
    teacherName: row.teacher.user.name,
    roomName: row.room.name,
  };
}

/** Upcoming sessions of active classes, soonest first. */
export async function getPublicSchedule({ days = 56, take = 200 } = {}): Promise<PublicSession[]> {
  const now = new Date();
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const rows = await prisma.classSession.findMany({
    where: { startTime: { gte: now, lte: until }, template: { isActive: true } },
    select: publicSessionSelect,
    orderBy: { startTime: "asc" },
    take,
  });
  return rows.map(toPublicSession);
}

export async function getPublicSession(id: string): Promise<PublicSession | null> {
  const row = await prisma.classSession.findFirst({
    where: { id, startTime: { gte: new Date() }, template: { isActive: true } },
    select: publicSessionSelect,
  });
  return row ? toPublicSession(row) : null;
}

/** Active classes with how many sessions are coming up and when the next one is. */
export async function getPublicClasses() {
  const now = new Date();
  const templates = await prisma.classTemplate.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      danceStyle: true,
      skillLevel: true,
      defaultDurationMins: true,
      basePriceCents: true,
      dropInEnabled: true,
      prices: { select: { plan: true, priceCents: true } },
      sessions: {
        where: { startTime: { gte: now } },
        select: { startTime: true },
        orderBy: { startTime: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return templates.map(({ sessions, ...template }) => ({
    ...template,
    upcomingCount: sessions.length,
    nextStart: sessions[0]?.startTime.toISOString() ?? null,
  }));
}

export async function getPublicClass(id: string) {
  const template = await prisma.classTemplate.findFirst({
    where: { id, isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      danceStyle: true,
      skillLevel: true,
      defaultDurationMins: true,
      basePriceCents: true,
      dropInEnabled: true,
      prices: { select: { plan: true, priceCents: true } },
      sessions: {
        where: { startTime: { gte: new Date() } },
        select: publicSessionSelect,
        orderBy: { startTime: "asc" },
        take: 24,
      },
    },
  });
  if (!template) return null;

  const { sessions, ...rest } = template;
  return { ...rest, sessions: sessions.map(toPublicSession) };
}

export async function getPublicTeachers() {
  const teachers = await prisma.teacher.findMany({
    select: {
      id: true,
      bio: true,
      specialties: true,
      photo: true,
      user: { select: { name: true } },
    },
    orderBy: { user: { name: "asc" } },
  });
  return teachers.map(({ user, ...teacher }) => ({ ...teacher, name: user.name }));
}

export async function getPublicStudio() {
  const studio = await prisma.studioProfile.findFirst({
    select: {
      name: true,
      timezone: true,
      address: true,
      phone: true,
      email: true,
    },
  });
  return {
    name: studio?.name ?? "Dance Studio",
    timezone: studio?.timezone ?? "America/New_York",
    address: studio?.address ?? null,
    phone: studio?.phone ?? null,
    email: studio?.email ?? null,
  };
}
