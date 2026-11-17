import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { addStudentProfile } from "@/lib/db/staff";

/** Lets a teacher take classes too: gives their account its own student record (admin). */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const result = await addStudentProfile(params.id, session.user.id);
    if (!result) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    return NextResponse.json(
      { data: { studentId: result.studentId, created: result.created } },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) {
    console.error("POST /api/teachers/[id]/student error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
