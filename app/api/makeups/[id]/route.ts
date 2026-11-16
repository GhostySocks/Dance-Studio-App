import { NextRequest, NextResponse } from "next/server";

import { requireStudentAccess } from "@/lib/api-auth";
import { cancelMakeup, getMakeupStudentId, MakeupError } from "@/lib/db/student-attendance";
import { isAdmin } from "@/lib/permissions";

/** Cancels a makeup so a different class can be chosen (staff can also undo a past one). */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, response } = await requireStudentAccess(await getMakeupStudentId(params.id));
    if (response) return response;

    // Only staff may undo a makeup whose class has already taken place
    await cancelMakeup({
      enrollmentId: params.id,
      actorId: session.user.id,
      allowPast: isAdmin(session),
    });
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    if (error instanceof MakeupError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("DELETE /api/makeups/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
