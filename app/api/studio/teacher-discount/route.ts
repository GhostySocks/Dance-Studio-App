import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { getTeacherDiscount, setTeacherDiscount } from "@/lib/db/studio";
import { teacherDiscountSchema } from "@/lib/validations/staff";

export const dynamic = "force-dynamic";

/** The studio's discount for teachers on classes they take (admin). */
export async function GET() {
  try {
    const { response } = await requireAdmin();
    if (response) return response;
    return NextResponse.json({ data: { discount: await getTeacherDiscount() } });
  } catch (error) {
    console.error("GET /api/studio/teacher-discount error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Sets or turns off the teacher discount (admin). */
export async function PUT(req: NextRequest) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const parsed = teacherDiscountSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid discount" }, { status: 400 });
    }

    const discount = parsed.data.type === "NONE" ? null : parsed.data;
    const saved = await setTeacherDiscount(discount, session.user.id);
    if (!saved) {
      return NextResponse.json({ error: "Save the studio profile first" }, { status: 400 });
    }
    return NextResponse.json({ data: { discount } });
  } catch (error) {
    console.error("PUT /api/studio/teacher-discount error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
