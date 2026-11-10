import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAttendanceReport } from "@/lib/db/attendance";

// Reads the session cookie, so it can never be prerendered
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const teacherId = searchParams.get("teacherId") ?? undefined;

    const result = await getAttendanceReport({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      teacherId,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("GET /api/attendance/report error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
