import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { getPaymentByIntentId } from "@/lib/db/payments";
import { canUserAccessInvoice } from "@/lib/db/billing-accounts";
import { settlePaymentSucceeded } from "@/lib/payment-service";
import { confirmPaymentSchema } from "@/lib/validations/payment";

/**
 * Called by the browser right after Stripe confirms a card payment, so the invoice
 * shows as paid immediately instead of waiting for the webhook. The status is always
 * re-read from Stripe — nothing the client sends is trusted.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = confirmPaymentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payment intent" }, { status: 400 });
    }

    const payment = await getPaymentByIntentId(parsed.data.paymentIntentId);
    if (!payment || !(await canUserAccessInvoice(session.user, payment.invoiceId))) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (!stripe) {
      return NextResponse.json({ error: "Online payments are not set up yet" }, { status: 500 });
    }

    const intent = await stripe.paymentIntents.retrieve(parsed.data.paymentIntentId);
    if (intent.status === "succeeded") {
      await settlePaymentSucceeded(intent.id);
    }

    return NextResponse.json({ data: { status: intent.status } });
  } catch (error) {
    console.error("POST /api/payments/confirm error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
