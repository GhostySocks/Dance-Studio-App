import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { unlockAttendance } from "@/lib/db/attendance";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can unlock
    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    if (!body.sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const result = await unlockAttendance(body.sessionId, session.user.id);
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("POST /api/attendance/unlock error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
