import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { InvoiceEditError, removeInvoiceLineItem } from "@/lib/db/invoices";

/** Removes a hand-added line from a draft invoice. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const invoice = await removeInvoiceLineItem({
      invoiceId: params.id,
      lineItemId: params.itemId,
      actorId: session.user.id,
    });
    return NextResponse.json({ data: invoice });
  } catch (error) {
    if (error instanceof InvoiceEditError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("DELETE /api/invoices/[id]/line-items/[itemId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
