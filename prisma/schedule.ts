import type { PrismaClient } from "@prisma/client";

import { tzOffsetMinutes, zonedTime } from "../lib/timezone";

export { zonedTime };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Same weekday and wall-clock time `weeks` later, even across a daylight-saving change. */
function shiftWeeks(date: Date, weeks: number, timeZone: string): Date {
  const shifted = new Date(date.getTime() + weeks * WEEK_MS);
  const drift = tzOffsetMinutes(date, timeZone) - tzOffsetMinutes(shifted, timeZone);
  return new Date(shifted.getTime() + drift * 60000);
}

/**
 * Makes sure every active class has a session in each of the next `weeks` weeks,
 * repeating its most recent session (same weekday, time, teacher, room, capacity).
 * Only adds sessions; never changes or removes anything. Safe to run repeatedly.
 */
export async function ensureUpcomingSessions(prisma: PrismaClient, weeks = 8): Promise<number> {
  const studio = await prisma.studioProfile.findFirst({ select: { timezone: true } });
  const timeZone = studio?.timezone ?? "America/New_York";
  const now = new Date();
  const horizon = new Date(now.getTime() + weeks * WEEK_MS);

  const templates = await prisma.classTemplate.findMany({
    where: { isActive: true },
    select: {
      id: true,
      sessions: {
        orderBy: { startTime: "desc" },
        select: { startTime: true, endTime: true, teacherId: true, roomId: true, maxCapacity: true },
      },
    },
  });

  const toCreate = [];
  for (const template of templates) {
    const pattern = template.sessions[0];
    if (!pattern) continue;
    const existing = new Set(template.sessions.map((s) => s.startTime.getTime()));

    // Walk forward (or back) from the latest session to cover the window
    const firstStep = Math.ceil((now.getTime() - pattern.startTime.getTime()) / WEEK_MS);
    for (let step = Math.max(firstStep, 1); ; step++) {
      const startTime = shiftWeeks(pattern.startTime, step, timeZone);
      if (startTime > horizon) break;
      if (startTime <= now || existing.has(startTime.getTime())) continue;
      toCreate.push({
        templateId: template.id,
        teacherId: pattern.teacherId,
        roomId: pattern.roomId,
        maxCapacity: pattern.maxCapacity,
        startTime,
        endTime: shiftWeeks(pattern.endTime, step, timeZone),
        isRecurring: true,
      });
    }
  }

  if (toCreate.length > 0) await prisma.classSession.createMany({ data: toCreate });
  return toCreate.length;
}
