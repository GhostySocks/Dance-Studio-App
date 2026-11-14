import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { addInvoiceLineItem, InvoiceEditError } from "@/lib/db/invoices";
import { invoiceLineItemSchema } from "@/lib/validations/invoice";

/** Adds a charge or a discount to a draft invoice by hand. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const parsed = invoiceLineItemSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid line" }, { status: 400 });
    }

    const invoice = await addInvoiceLineItem({
      invoiceId: params.id,
      ...parsed.data,
      actorId: session.user.id,
    });
    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (error) {
    if (error instanceof InvoiceEditError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/invoices/[id]/line-items error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
