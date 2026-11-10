import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInvoiceById, updateInvoiceStatus, deleteInvoice } from "@/lib/db/invoices";
import { invoiceStatusSchema } from "@/lib/validations/invoice";
import { sendInvoiceEmail } from "@/lib/email";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invoice = await getInvoiceById(params.id);
    if (!invoice) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data: invoice });
  } catch (error) {
    console.error("GET /api/invoices/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = invoiceStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const invoice = await updateInvoiceStatus(params.id, parsed.data.status);
    if (parsed.data.status === "SENT") {
      await sendInvoiceEmail(invoice.id, "sent");
    } else if (parsed.data.status === "PAID") {
      await sendInvoiceEmail(invoice.id, "receipt");
    }
    return NextResponse.json({ data: invoice });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("PUT /api/invoices/[id] error:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteInvoice(params.id);
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("DELETE /api/invoices/[id] error:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
