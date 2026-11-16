import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getOwnAttendance } from "@/lib/db/student-attendance";
import { hasRole } from "@/lib/permissions";

// Reads the session cookie, so it can never be prerendered
export const dynamic = "force-dynamic";

/** Attendance for the signed-in parent's children, or the adult student themself. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasRole(session, "PARENT", "STUDENT")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const attendance = await getOwnAttendance(session.user.id);
    return NextResponse.json({ data: attendance });
  } catch (error) {
    console.error("GET /api/portal/attendance error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
