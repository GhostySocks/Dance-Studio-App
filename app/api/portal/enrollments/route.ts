import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { enrollStudent } from "@/lib/db/enrollment";
import { getPublicSession } from "@/lib/db/public";
import { getEnrollableStudents } from "@/lib/db/registration";
import { sendEnrollmentConfirmation } from "@/lib/email";
import { hasRole } from "@/lib/permissions";
import { portalEnrollSchema } from "@/lib/validations/registration";

/** Self-service enrollment: a parent enrolls their children, or an adult student themself. */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasRole(session, "PARENT", "STUDENT")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = portalEnrollSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }
    const { studentIds, sessionId } = parsed.data;

    const own = await getEnrollableStudents(session.user.id);
    const students = own.filter((s) => studentIds.includes(s.id));
    if (students.length !== new Set(studentIds).size) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    if (!(await getPublicSession(sessionId))) {
      return NextResponse.json({ error: "That class is no longer available." }, { status: 404 });
    }

    const results = [];
    for (const student of students) {
      // No `force`: only admins may enroll past capacity
      const result = await enrollStudent({ studentId: student.id, sessionId });
      if (result.success && result.enrollment) {
        await sendEnrollmentConfirmation(result.enrollment.id);
      }
      results.push({
        studentId: student.id,
        name: `${student.firstName} ${student.lastName}`,
        success: result.success,
        waitlist: result.waitlist ?? false,
        error: result.success ? null : (result.error ?? "Could not enroll"),
      });
    }

    const anySuccess = results.some((r) => r.success);
    return NextResponse.json({ data: results }, { status: anySuccess ? 201 : 409 });
  } catch (error) {
    console.error("POST /api/portal/enrollments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
