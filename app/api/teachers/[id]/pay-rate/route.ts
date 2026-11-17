import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { getTeacherPayRate, setTeacherPayRate } from "@/lib/db/teacher-pay-rate";
import { teacherPayRateSchema } from "@/lib/validations/teacher-payment";

export const dynamic = "force-dynamic";

/** The pay rate kept for one teacher (admin). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;
    const found = await getTeacherPayRate(params.id);
    if (!found) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    return NextResponse.json({ data: found });
  } catch (error) {
    console.error("GET /api/teachers/[id]/pay-rate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Sets or clears the pay rate kept for one teacher (admin). */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const parsed = teacherPayRateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid pay rate" }, { status: 400 });
    }

    const { basis, rateCents } = parsed.data;
    const rate = rateCents === null ? null : { basis, rateCents };
    const saved = await setTeacherPayRate({ teacherId: params.id, rate, actorId: session.user.id });
    if (!saved) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    return NextResponse.json({ data: { rate } });
  } catch (error) {
    console.error("PUT /api/teachers/[id]/pay-rate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
