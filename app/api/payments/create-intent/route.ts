import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { createPayment, getPendingPayment } from "@/lib/db/payments";
import { getInvoiceById } from "@/lib/db/invoices";
import { canUserAccessInvoice } from "@/lib/db/billing-accounts";
import { createIntentSchema } from "@/lib/validations/payment";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = createIntentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
    }
    const { invoiceId } = parsed.data;

    if (!(await canUserAccessInvoice(session.user, invoiceId))) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status !== "SENT" && invoice.status !== "OVERDUE") {
      return NextResponse.json(
        { error: `Invoice is ${invoice.status.toLowerCase()} and cannot be paid` },
        { status: 400 }
      );
    }

    if (!stripe) {
      return NextResponse.json(
        { error: "Online payments are not set up yet" },
        { status: 500 }
      );
    }

    // Reuse an open PaymentIntent rather than creating one per click
    const pending = await getPendingPayment(invoice.id);
    if (pending?.stripePaymentIntentId && pending.amountCents === invoice.totalCents) {
      const existing = await stripe.paymentIntents.retrieve(pending.stripePaymentIntentId);
      if (
        existing.client_secret &&
        ["requires_payment_method", "requires_confirmation", "requires_action"].includes(
          existing.status
        )
      ) {
        return NextResponse.json({
          data: { clientSecret: existing.client_secret, paymentIntentId: existing.id },
        });
      }
    }

    const description = invoice.familyGroup
      ? `Invoice for ${invoice.familyGroup.name}`
      : invoice.student
        ? `Invoice for ${invoice.student.firstName} ${invoice.student.lastName}`
        : `Invoice ${invoice.id}`;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: invoice.totalCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: { invoiceId: invoice.id, userId: session.user.id },
      description,
    });

    await createPayment({
      invoiceId: invoice.id,
      amountCents: invoice.totalCents,
      stripePaymentIntentId: paymentIntent.id,
    });

    return NextResponse.json(
      {
        data: {
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/payments/create-intent error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
