import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getEnrollmentById,
  updateEnrollmentStatus,
  cancelEnrollment,
  deleteEnrollment,
} from "@/lib/db/enrollment";
import { sendEnrollmentConfirmation } from "@/lib/email";
import { enrollmentStatusSchema } from "@/lib/validations/enrollment";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const enrollment = await getEnrollmentById(params.id);
    if (!enrollment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data: enrollment });
  } catch (error) {
    console.error("GET /api/enrollments/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = enrollmentStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    if (parsed.data.status === "CANCELLED") {
      const result = await cancelEnrollment(params.id);
      if (result.promoted) {
        // Tell the promoted student they are off the waitlist
        await sendEnrollmentConfirmation(result.promoted.id);
      }
      return NextResponse.json({
        data: result.cancelled,
        promoted: result.promoted
          ? { id: result.promoted.id, studentId: result.promoted.studentId }
          : null,
        message: result.promoted
          ? "Enrollment cancelled. A waitlisted student was promoted to active."
          : "Enrollment cancelled.",
      });
    }

    const enrollment = await updateEnrollmentStatus(params.id, parsed.data.status);
    await sendEnrollmentConfirmation(enrollment.id);
    return NextResponse.json({ data: enrollment });
  } catch (error) {
    console.error("PUT /api/enrollments/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteEnrollment(params.id);
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error("DELETE /api/enrollments/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
