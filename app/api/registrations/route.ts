import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { requireAdmin } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { getEnrollableStudents } from "@/lib/db/registration";
import { createRegistration, getRegistrations } from "@/lib/db/registrations";
import { getStudentNames } from "@/lib/db/students";
import { sendRegistrationConfirmation } from "@/lib/email";
import { hasRole, isAdmin } from "@/lib/permissions";
import { createRegistrationSchema } from "@/lib/validations/term";

export const dynamic = "force-dynamic";

/** Admin list of term registrations. */
export async function GET(req: NextRequest) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") ?? 1);
    const result = await getRegistrations({
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      page: Number.isInteger(page) && page > 0 ? page : 1,
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("GET /api/registrations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Registers students for every date of a class in a term. Admins may register any
 * student; parents their own children; adult students themselves.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const admin = isAdmin(session);
    if (!admin && !hasRole(session, "PARENT", "STUDENT")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = createRegistrationSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }
    const { templateId, termId, plan } = parsed.data;
    const studentIds = Array.from(new Set(parsed.data.studentIds));

    const allowed = admin
      ? await getStudentNames(studentIds)
      : (await getEnrollableStudents(session.user.id)).filter((s) => studentIds.includes(s.id));
    if (allowed.length !== studentIds.length) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const results = [];
    for (const student of allowed) {
      const result = await createRegistration({
        studentId: student.id,
        templateId,
        termId,
        plan,
        actorId: session.user.id,
      });
      if (result.ok) await sendRegistrationConfirmation(result.registrationId);
      results.push({
        studentId: student.id,
        name: `${student.firstName} ${student.lastName}`,
        success: result.ok,
        enrolled: result.ok ? result.enrolled : 0,
        waitlisted: result.ok ? result.waitlisted : 0,
        error: result.ok ? null : result.error,
      });
    }

    const anySuccess = results.some((r) => r.success);
    return NextResponse.json({ data: results }, { status: anySuccess ? 201 : 409 });
  } catch (error) {
    console.error("POST /api/registrations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
