import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { getStudioInfo } from "@/lib/db/recipients";
import { getTeacherPayments, recordTeacherPayment, TeacherPaymentError } from "@/lib/db/teacher-payments";
import { teacherPaymentSchema } from "@/lib/validations/teacher-payment";

export const dynamic = "force-dynamic";

/** The payments recorded for one teacher (admin). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;
    return NextResponse.json({ data: await getTeacherPayments(params.id) });
  } catch (error) {
    console.error("GET /api/teachers/[id]/payments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Records a payment made to a teacher for a period (admin). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const parsed = teacherPaymentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payment" }, { status: 400 });
    }

    const { timezone } = await getStudioInfo();
    const payment = await recordTeacherPayment({
      teacherId: params.id,
      startDay: parsed.data.start,
      endDay: parsed.data.end,
      amountCents: parsed.data.amountCents,
      basis: parsed.data.basis,
      rateCents: parsed.data.rateCents,
      paidOn: parsed.data.paidOn,
      reference: parsed.data.reference,
      note: parsed.data.note,
      timeZone: timezone,
      actorId: session.user.id,
    });
    return NextResponse.json({ data: payment }, { status: 201 });
  } catch (error) {
    if (error instanceof TeacherPaymentError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/teachers/[id]/payments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
