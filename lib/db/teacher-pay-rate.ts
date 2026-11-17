import { prisma } from "@/lib/prisma";
import type { PayBasis } from "@/lib/teacher-report";

/** What a teacher is paid per class or per hour. */
export interface TeacherPayRate {
  basis: PayBasis;
  rateCents: number;
}

const toBasis = (value: string | null): PayBasis => (value === "PER_HOUR" ? "PER_HOUR" : "PER_CLASS");

/**
 * The pay rate kept for a teacher. `rate` is null when none has been set;
 * the whole result is null when the teacher does not exist.
 */
export async function getTeacherPayRate(teacherId: string): Promise<{ rate: TeacherPayRate | null } | null> {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: { payBasis: true, payRateCents: true },
  });
  if (!teacher) return null;
  return {
    rate:
      teacher.payRateCents !== null && teacher.payRateCents > 0
        ? { basis: toBasis(teacher.payBasis), rateCents: teacher.payRateCents }
        : null,
  };
}

/**
 * Sets the pay rate kept for a teacher, or clears it with `null`. It stays until
 * it is changed here; payments already recorded keep the rate they were made at.
 * Returns false if the teacher does not exist.
 */
export async function setTeacherPayRate({
  teacherId,
  rate,
  actorId,
}: {
  teacherId: string;
  rate: TeacherPayRate | null;
  actorId: string;
}): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const teacher = await tx.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true, payBasis: true, payRateCents: true },
    });
    if (!teacher) return false;

    const next = { payBasis: rate?.basis ?? null, payRateCents: rate?.rateCents ?? null };
    if (teacher.payBasis === next.payBasis && teacher.payRateCents === next.payRateCents) return true;

    await tx.teacher.update({ where: { id: teacherId }, data: next });
    await tx.auditLog.create({
      data: {
        actorId,
        action: "TEACHER_PAY_RATE_SET",
        entityType: "Teacher",
        entityId: teacherId,
        meta: {
          basis: next.payBasis,
          rateCents: next.payRateCents,
          previousBasis: teacher.payBasis,
          previousRateCents: teacher.payRateCents,
        },
      },
    });
    return true;
  });
}
