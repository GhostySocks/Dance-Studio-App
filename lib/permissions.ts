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
