import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/api-auth";
import { getEnrollments, enrollStudent, bulkEnrollStudents } from "@/lib/db/enrollment";
import { enrollmentSchema, bulkEnrollSchema } from "@/lib/validations/enrollment";
import { sendEnrollmentConfirmation } from "@/lib/email";

export async function GET(req: NextRequest) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const result = await getEnrollments({
      sessionId: searchParams.get("sessionId") ?? undefined,
      studentId: searchParams.get("studentId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      page: Number(searchParams.get("page") ?? 1),
      perPage: Number(searchParams.get("perPage") ?? 20),
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("GET /api/enrollments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    // Check if it's a bulk enrollment
    if (body.studentIds) {
      const parsed = bulkEnrollSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }
      const results = await bulkEnrollStudents(parsed.data);
      await Promise.all(
        results.map((r) => (r.enrollment ? sendEnrollmentConfirmation(r.enrollment.id) : null))
      );
      return NextResponse.json({ data: results }, { status: 201 });
    }

    const parsed = enrollmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await enrollStudent(parsed.data);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    if (result.enrollment) {
      await sendEnrollmentConfirmation(result.enrollment.id);
    }

    return NextResponse.json(
      {
        data: result.enrollment,
        waitlist: result.waitlist,
        message: result.waitlist
          ? "Class is full. Student has been added to the waitlist."
          : "Student enrolled successfully.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/enrollments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
