import type { UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Sessions are signed tokens that stay valid for weeks, so removing someone would
 * not sign them out by itself. Every request therefore re-checks that the account
 * still exists and is not disabled, and picks up its current role.
 *
 * The answer is remembered for a few seconds to avoid a database round trip per
 * request; removing an account clears its entry so it takes effect at once.
 */
const TTL_MS = 15 * 1000;

const cache = new Map<string, { role: UserRole | null; expires: number }>();

/** The account's current role, or null if it was removed, disabled or never existed. */
export async function getActiveRole(userId: string): Promise<UserRole | null> {
  const hit = cache.get(userId);
  if (hit && hit.expires > Date.now()) return hit.role;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, disabledAt: true },
  });
  const role = user && !user.disabledAt ? user.role : null;

  if (cache.size > 5000) cache.clear();
  cache.set(userId, { role, expires: Date.now() + TTL_MS });
  return role;
}

export function clearAccountStatus(userId: string) {
  cache.delete(userId);
}
