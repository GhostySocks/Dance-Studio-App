import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { billingPeriod } from "@/lib/billing-period";
import { generateAllInvoices } from "@/lib/db/invoices";
import { getStudioInfo } from "@/lib/db/recipients";
import { generateAllInvoicesSchema } from "@/lib/validations/invoice";

/** Generates a draft invoice for every family group and unattached student with something due. */
export async function POST(req: NextRequest) {
  try {
    const { session, response } = await requireAdmin();
    if (!session) return response;

    const parsed = generateAllInvoicesSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Choose a valid billing period" }, { status: 400 });
    }

    const { timezone } = await getStudioInfo();
    const result = await generateAllInvoices({
      ...billingPeriod(timezone, parsed.data.periodStart, parsed.data.periodEnd),
      actorId: session.user.id,
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/invoices/generate-all error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
