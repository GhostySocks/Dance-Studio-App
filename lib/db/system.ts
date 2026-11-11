import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/** Cheapest possible round trip, for the health check. */
export async function pingDatabase() {
  await prisma.$queryRaw`SELECT 1`;
}

const BILLING_JOB = "BILLING_JOB_RUN";

/**
 * Claims the nightly billing run for a given day ("YYYY-MM-DD"). Returns true for
 * exactly one caller per day, even if several server instances ask at once, or the
 * server restarts and asks again: the claim is an AuditLog row, taken under a
 * transaction-scoped advisory lock.
 */
export async function claimBillingRun(day: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    // $executeRaw: the function returns void, which $queryRaw cannot deserialize
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('billing-job'))`;

    const existing = await tx.auditLog.findFirst({
      where: { action: BILLING_JOB, entityType: "System", entityId: day },
      select: { id: true },
    });
    if (existing) return false;

    await tx.auditLog.create({
      data: { action: BILLING_JOB, entityType: "System", entityId: day, meta: { status: "started" } },
    });
    return true;
  });
}

/** Stores what the run did (or why it failed) on the day's claim row. */
export async function recordBillingRun(day: string, meta: Prisma.InputJsonObject) {
  await prisma.auditLog.updateMany({
    where: { action: BILLING_JOB, entityType: "System", entityId: day },
    data: { meta },
  });
}
