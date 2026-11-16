import { NextRequest, NextResponse } from "next/server";

import { requireStudentAccess } from "@/lib/api-auth";
import { bookMakeup, getAttendanceStudentId, MakeupError } from "@/lib/db/student-attendance";
import { isAdmin } from "@/lib/permissions";
import { bookMakeupSchema } from "@/lib/validations/makeup";

/** Books a makeup class for a missed class: the family themselves, or an admin. */
export async function POST(req: NextRequest) {
  try {
    const parsed = bookMakeupSchema.safeParse(await req.json().catch(() => null));
    // The access check runs either way, so a signed-out caller always gets 401
    const studentId = parsed.success ? await getAttendanceStudentId(parsed.data.attendanceId) : null;
    const { session, response } = await requireStudentAccess(studentId);
    if (response) return response;
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    // Only staff may count a class that has already taken place
    const enrollment = await bookMakeup({
      ...parsed.data,
      actorId: session.user.id,
      allowPast: isAdmin(session),
    });
    return NextResponse.json({ data: { id: enrollment.id } }, { status: 201 });
  } catch (error) {
    if (error instanceof MakeupError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/makeups error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
