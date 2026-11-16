import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { getStudentAttendance } from "@/lib/db/student-attendance";

/** One student's attendance history and makeups (admin). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const attendance = await getStudentAttendance(params.id);
    if (!attendance) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: attendance });
  } catch (error) {
    console.error("GET /api/students/[id]/attendance error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
