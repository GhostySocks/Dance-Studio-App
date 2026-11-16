import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getStudioInfo } from "@/lib/db/recipients";
import { getTeacherIdForUser, getTeacherReport } from "@/lib/db/teacher-report";
import { reportPeriodSchema } from "@/lib/validations/teacher-report";

export const dynamic = "force-dynamic";

/** What the signed-in teacher taught between ?start= and ?end=. */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // Looked up from the signed-in user, so a teacher only ever sees their own report
    const teacherId = await getTeacherIdForUser(session.user.id);
    if (!teacherId) return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const parsed = reportPeriodSchema.safeParse({
      start: searchParams.get("start"),
      end: searchParams.get("end"),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid period" }, { status: 400 });
    }

    const { timezone, name } = await getStudioInfo();
    const report = await getTeacherReport({
      teacherId: teacherId,
      startDay: parsed.data.start,
      endDay: parsed.data.end,
      timeZone: timezone,
      studioName: name,
    });
    if (!report) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    return NextResponse.json({ data: report });
  } catch (error) {
    console.error("GET /api/teachers/me/report error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
