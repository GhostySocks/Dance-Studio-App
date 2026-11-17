import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UserRole } from "@prisma/client";

export async function getSession() {
  return getServerSession(authOptions);
}

export function requireRole(
  session: { user: { role: UserRole } } | null,
  ...roles: UserRole[]
) {
  if (!session) {
    throw new Error("Unauthorized: No session");
  }
  if (!roles.includes(session.user.role)) {
    throw new Error(`Forbidden: Requires role ${roles.join(" or ")}`);
  }
}

export function hasRole(
  session: { user: { role: UserRole } } | null,
  ...roles: UserRole[]
): boolean {
  if (!session) return false;
  return roles.includes(session.user.role);
}

/**
 * Someone who uses the family portal for themself or their children: a parent,
 * an adult student, or a member of staff who also takes classes (they have their
 * own student record). What they can reach is still looked up by their user id.
 */
export function isPortalUser(
  session: { user: { role: UserRole; takesClasses?: boolean } } | null
): boolean {
  if (!session) return false;
  return hasRole(session, "PARENT", "STUDENT") || session.user.takesClasses === true;
}

export function isAdmin(session: { user: { role: UserRole } } | null): boolean {
  return hasRole(session, "SUPER_ADMIN", "ADMIN");
}

export function isTeacher(session: { user: { role: UserRole } } | null): boolean {
  return hasRole(session, "TEACHER");
}

export function isParent(session: { user: { role: UserRole } } | null): boolean {
  return hasRole(session, "PARENT");
}

export function isStudent(session: { user: { role: UserRole } } | null): boolean {
  return hasRole(session, "STUDENT");
}
