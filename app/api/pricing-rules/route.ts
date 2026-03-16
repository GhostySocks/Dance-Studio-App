import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPricingRules, createPricingRule } from "@/lib/db/invoices";
import { pricingRuleSchema } from "@/lib/validations/invoice";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rules = await getPricingRules();
    return NextResponse.json({ data: rules });
  } catch (error) {
    console.error("GET /api/pricing-rules error:", error);
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
    const parsed = pricingRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const rule = await createPricingRule({
      name: data.name,
      familyGroupId: data.familyGroupId || null,
      triggerCount: data.triggerCount,
      discountType: data.discountType,
      discountValue: data.discountValue,
      isGlobal: data.isGlobal,
    });

    return NextResponse.json({ data: rule }, { status: 201 });
  } catch (error) {
    console.error("POST /api/pricing-rules error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
