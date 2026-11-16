import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { getStudioInfo } from "@/lib/db/recipients";
import { getTeacherReport } from "@/lib/db/teacher-report";
import { reportPeriodSchema } from "@/lib/validations/teacher-report";

export const dynamic = "force-dynamic";

/** What one teacher taught between ?start= and ?end= (admin). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const parsed = reportPeriodSchema.safeParse({
      start: searchParams.get("start"),
      end: searchParams.get("end"),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid period" }, { status: 400 });
    }

    const { timezone } = await getStudioInfo();
    const report = await getTeacherReport({
      teacherId: params.id,
      startDay: parsed.data.start,
      endDay: parsed.data.end,
      timeZone: timezone,
    });
    if (!report) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    return NextResponse.json({ data: report });
  } catch (error) {
    console.error("GET /api/teachers/[id]/report error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
