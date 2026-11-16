import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { deleteTeacherPayment } from "@/lib/db/teacher-payments";

export const dynamic = "force-dynamic";

/** Removes a payment record that was entered by mistake (admin). */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string; paymentId: string } }) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const removed = await deleteTeacherPayment({
      teacherId: params.id,
      paymentId: params.paymentId,
      actorId: session.user.id,
    });
    if (!removed) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    return NextResponse.json({ data: { id: params.paymentId } });
  } catch (error) {
    console.error("DELETE /api/teachers/[id]/payments/[paymentId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
