import { prisma } from "@/lib/prisma";
import { endOfDayIn, startOfDayIn } from "@/lib/timezone";

const closureSelect = { id: true, name: true, startDay: true, endDay: true } as const;

/**
 * Closures that touch a range of days (both optional, "YYYY-MM-DD"), earliest
 * first. Day strings sort the same way the days do, so they compare directly.
 */
export async function getClosures({ from, to }: { from?: string; to?: string } = {}) {
  return prisma.studioClosure.findMany({
    where: {
      ...(from ? { endDay: { gte: from } } : {}),
      ...(to ? { startDay: { lte: to } } : {}),
    },
    select: closureSelect,
    orderBy: [{ startDay: "asc" }, { endDay: "asc" }],
  });
}

/**
 * Adds a closure and reports how many classes are already scheduled on those
 * days. Those classes are not removed: they stop showing on the public schedule,
 * and the admin decides what to do with them.
 */
export async function createClosure({
  name,
  startDay,
  endDay,
  timeZone,
  actorId,
}: {
  name: string;
  startDay: string;
  endDay: string;
  timeZone: string;
  actorId: string;
}) {
  const [closure, classesAffected] = await Promise.all([
    prisma.studioClosure.create({ data: { name, startDay, endDay }, select: closureSelect }),
    prisma.classSession.count({
      where: {
        startTime: { gte: startOfDayIn(timeZone, startDay), lte: endOfDayIn(timeZone, endDay) },
      },
    }),
  ]);
  await prisma.auditLog.create({
    data: {
      actorId,
      action: "CLOSURE_ADDED",
      entityType: "StudioClosure",
      entityId: closure.id,
      meta: { name, startDay, endDay, classesAffected },
    },
  });
  return { closure, classesAffected };
}

/** Removes a closure. Returns false if it was already gone. */
export async function deleteClosure(id: string, actorId: string): Promise<boolean> {
  const { count } = await prisma.studioClosure.deleteMany({ where: { id } });
  if (count === 0) return false;
  await prisma.auditLog.create({
    data: { actorId, action: "CLOSURE_REMOVED", entityType: "StudioClosure", entityId: id },
  });
  return true;
}
