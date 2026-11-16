import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getTeacherPayments } from "@/lib/db/teacher-payments";
import { getTeacherIdForUser } from "@/lib/db/teacher-report";

export const dynamic = "force-dynamic";

/** The payments recorded for the signed-in teacher. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // Looked up from the signed-in user, so a teacher only ever sees their own payments
    const teacherId = await getTeacherIdForUser(session.user.id);
    if (!teacherId) return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });
    return NextResponse.json({ data: await getTeacherPayments(teacherId) });
  } catch (error) {
    console.error("GET /api/teachers/me/payments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
