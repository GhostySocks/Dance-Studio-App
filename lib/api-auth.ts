import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { userOwnsStudent } from "@/lib/db/student-attendance";
import { hasRole, isAdmin } from "@/lib/permissions";

/**
 * Session + admin check for route handlers. Returns the session, or the
 * 401/403 response to send back.
 */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { session: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isAdmin(session)) {
    return { session: null, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, response: null };
}

/**
 * Session check for something that concerns one student: an admin, or the parent
 * or adult student the student belongs to. Teachers are refused. Someone else's
 * student is reported as not found, so ids cannot be probed.
 */
export async function requireStudentAccess(studentId: string | null) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { session: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const notFound = { session: null, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!studentId) return notFound;
  if (isAdmin(session)) return { session, response: null };
  if (!hasRole(session, "PARENT", "STUDENT")) {
    return { session: null, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (!(await userOwnsStudent(session.user.id, studentId))) return notFound;
  return { session, response: null };
}
