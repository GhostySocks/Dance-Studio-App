import { NextRequest, NextResponse } from "next/server";

import { requireStudentAccess } from "@/lib/api-auth";
import { getMakeupOptions } from "@/lib/db/student-attendance";
import { isAdmin } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Classes the student could count as a makeup: upcoming ones with a free spot, or
 * (?when=past, staff only) ones that have already taken place.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const { session, response } = await requireStudentAccess(studentId);
    if (response) return response;

    // Counting a class that already happened is for staff only
    const when = searchParams.get("when") === "past" ? "past" : "upcoming";
    if (when === "past" && !isAdmin(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ data: await getMakeupOptions(studentId as string, when) });
  } catch (error) {
    console.error("GET /api/makeups/options error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
