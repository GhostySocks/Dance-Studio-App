import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInvoices, createInvoiceFromBilling } from "@/lib/db/invoices";
import { generateInvoiceSchema } from "@/lib/validations/invoice";
import { billingPeriod } from "@/lib/billing-period";
import { getStudioInfo } from "@/lib/db/recipients";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const result = await getInvoices({
      status: searchParams.get("status") ?? undefined,
      familyGroupId: searchParams.get("familyGroupId") ?? undefined,
      studentId: searchParams.get("studentId") ?? undefined,
      page: Number(searchParams.get("page") ?? 1),
      perPage: Number(searchParams.get("perPage") ?? 20),
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("GET /api/invoices error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = generateInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // The chosen days are studio calendar days, both included in full
    const { timezone } = await getStudioInfo();
    const result = await createInvoiceFromBilling({
      familyGroupId: parsed.data.familyGroupId,
      studentId: parsed.data.studentId,
      ...billingPeriod(timezone, parsed.data.periodStart, parsed.data.periodEnd),
    });

    if (!result.invoice) {
      return NextResponse.json({ error: result.message }, { status: 404 });
    }

    return NextResponse.json({ data: result.invoice, message: result.message }, { status: 201 });
  } catch (error) {
    console.error("POST /api/invoices error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
