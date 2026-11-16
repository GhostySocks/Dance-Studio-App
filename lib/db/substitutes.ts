import { prisma } from "@/lib/prisma";

/** A problem the admin can act on; the message is safe to show. */
export class SubstituteError extends Error {}

/**
 * Puts a substitute in charge of one class date. The substitute becomes the
 * class's teacher (so the roster, attendance and the pay report follow them),
 * and the regular teacher is remembered in `substituteForId` so the change can
 * be seen, reported and undone. Works for past dates too, to record a
 * substitution after the fact.
 */
export async function assignSubstitute({
  sessionId,
  substituteTeacherId,
  reason,
  actorId,
}: {
  sessionId: string;
  substituteTeacherId: string;
  reason?: string;
  actorId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const [session, substitute] = await Promise.all([
      tx.classSession.findUnique({
        where: { id: sessionId },
        select: { teacherId: true, substituteForId: true, startTime: true, endTime: true },
      }),
      tx.teacher.findUnique({
        where: { id: substituteTeacherId },
        select: { id: true, removedAt: true, user: { select: { name: true, disabledAt: true } } },
      }),
    ]);
    if (!session) throw new SubstituteError("Class not found");
    if (!substitute || substitute.user.disabledAt || substitute.removedAt) {
      throw new SubstituteError("That teacher is no longer available");
    }

    // Changing an existing substitute keeps the original regular teacher
    const regularTeacherId = session.substituteForId ?? session.teacherId;
    if (substituteTeacherId === regularTeacherId) {
      throw new SubstituteError(
        "That is the class's regular teacher. Remove the substitute instead."
      );
    }

    const clash = await tx.classSession.findFirst({
      where: {
        id: { not: sessionId },
        teacherId: substituteTeacherId,
        startTime: { lt: session.endTime },
        endTime: { gt: session.startTime },
      },
      select: { template: { select: { name: true } } },
    });
    if (clash) {
      throw new SubstituteError(
        `${substitute.user.name ?? "That teacher"} is already teaching ${clash.template.name} at that time`
      );
    }

    const cleanReason = reason?.trim() || null;
    await tx.auditLog.create({
      data: {
        actorId,
        action: "SUBSTITUTE_ASSIGNED",
        entityType: "ClassSession",
        entityId: sessionId,
        meta: { regularTeacherId, substituteTeacherId, reason: cleanReason },
      },
    });
    return tx.classSession.update({
      where: { id: sessionId },
      data: {
        teacherId: substituteTeacherId,
        substituteForId: regularTeacherId,
        substituteReason: cleanReason,
      },
      select: { id: true, teacherId: true, substituteForId: true },
    });
  });
}

/** Hands a class date back to its regular teacher. */
export async function removeSubstitute({ sessionId, actorId }: { sessionId: string; actorId: string }) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.classSession.findUnique({
      where: { id: sessionId },
      select: { teacherId: true, substituteForId: true },
    });
    if (!session) throw new SubstituteError("Class not found");
    if (!session.substituteForId) throw new SubstituteError("This class has no substitute");

    await tx.auditLog.create({
      data: {
        actorId,
        action: "SUBSTITUTE_REMOVED",
        entityType: "ClassSession",
        entityId: sessionId,
        meta: { regularTeacherId: session.substituteForId, substituteTeacherId: session.teacherId },
      },
    });
    return tx.classSession.update({
      where: { id: sessionId },
      data: { teacherId: session.substituteForId, substituteForId: null, substituteReason: null },
      select: { id: true, teacherId: true, substituteForId: true },
    });
  });
}
