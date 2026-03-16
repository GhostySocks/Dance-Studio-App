import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { submitAttendance } from "@/lib/db/attendance";
import { submitAttendanceSchema } from "@/lib/validations/attendance";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN", "TEACHER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = submitAttendanceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await submitAttendance(parsed.data.sessionId, session.user.id);
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("POST /api/attendance/submit error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
