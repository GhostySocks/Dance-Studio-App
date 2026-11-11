import { NextRequest, NextResponse } from "next/server";
import { requireAttendanceAccess } from "@/lib/attendance-access";
import { submitAttendance } from "@/lib/db/attendance";
import { submitAttendanceSchema } from "@/lib/validations/attendance";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = submitAttendanceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Admins, or the instructor who teaches this class
    const { session, response } = await requireAttendanceAccess(parsed.data.sessionId);
    if (response) return response;

    const result = await submitAttendance(parsed.data.sessionId, session.user.id);
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("POST /api/attendance/submit error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
