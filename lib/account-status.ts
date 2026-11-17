import type { UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Sessions are signed tokens that stay valid for weeks, so removing someone would
 * not sign them out by itself. Every request therefore re-checks that the account
 * still exists and is not disabled, and picks up its current role, whether it
 * has a teacher profile (an administrator can also teach) and whether it has its
 * own student record (a teacher can also take classes).
 *
 * The answer is remembered for a few seconds to avoid a database round trip per
 * request; removing an account clears its entry so it takes effect at once.
 */
const TTL_MS = 15 * 1000;

export interface AccountStatus {
  role: UserRole;
  /** The account has a current teacher profile */
  teaches: boolean;
  /** The account has its own student record (an adult student, or staff who take classes) */
  takesClasses: boolean;
}

const cache = new Map<string, { status: AccountStatus | null; expires: number }>();

/** The account's current role and teacher status, or null if it was removed, disabled or never existed. */
export async function getAccountStatus(userId: string): Promise<AccountStatus | null> {
  const hit = cache.get(userId);
  if (hit && hit.expires > Date.now()) return hit.status;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      disabledAt: true,
      teacher: { select: { removedAt: true } },
      student: { select: { id: true } },
    },
  });
  const status =
    user && !user.disabledAt
      ? {
          role: user.role,
          teaches: user.teacher !== null && user.teacher.removedAt === null,
          takesClasses: user.student !== null,
        }
      : null;

  if (cache.size > 5000) cache.clear();
  cache.set(userId, { status, expires: Date.now() + TTL_MS });
  return status;
}

export function clearAccountStatus(userId: string) {
  cache.delete(userId);
}
