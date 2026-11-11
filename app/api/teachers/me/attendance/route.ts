import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { endOfStudioToday } from "@/lib/attendance-access";
import { authOptions } from "@/lib/auth";
import { getTeacherAttendanceSessions } from "@/lib/db/attendance";
import { hasRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** The signed-in instructor's classes that can have attendance taken now. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasRole(session, "TEACHER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sessions = await getTeacherAttendanceSessions(session.user.id, await endOfStudioToday());
    return NextResponse.json({ data: sessions });
  } catch (error) {
    console.error("GET /api/teachers/me/attendance error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
