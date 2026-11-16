import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { duplicateInvoice, InvoiceEditError } from "@/lib/db/invoices";

/** Copies an invoice into a new draft for the same family or student. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const invoice = await duplicateInvoice(params.id, session.user.id);
    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (error) {
    if (error instanceof InvoiceEditError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/invoices/[id]/duplicate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
