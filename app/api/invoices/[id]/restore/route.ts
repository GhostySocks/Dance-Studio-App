import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { InvoiceEditError, restoreVoidedInvoice } from "@/lib/db/invoices";

/** Brings back an invoice that was voided by mistake. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const invoice = await restoreVoidedInvoice(params.id, session.user.id);
    return NextResponse.json({ data: invoice });
  } catch (error) {
    if (error instanceof InvoiceEditError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/invoices/[id]/restore error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
