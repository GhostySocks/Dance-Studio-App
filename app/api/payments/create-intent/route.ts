import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { createPayment } from "@/lib/db/payments";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { invoiceId } = body;

    if (!invoiceId) {
      return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        student: { select: { firstName: true, lastName: true } },
        familyGroup: { select: { name: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status === "PAID" || invoice.status === "VOID") {
      return NextResponse.json(
        { error: `Invoice is already ${invoice.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    const description = invoice.familyGroup
      ? `Invoice for ${invoice.familyGroup.name}`
      : invoice.student
        ? `Invoice for ${invoice.student.firstName} ${invoice.student.lastName}`
        : `Invoice ${invoice.id}`;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: invoice.totalCents,
      currency: "usd",
      metadata: {
        invoiceId: invoice.id,
        userId: session.user.id,
      },
      description,
    });

    // Create payment record
    await createPayment({
      invoiceId: invoice.id,
      amountCents: invoice.totalCents,
      stripePaymentIntentId: paymentIntent.id,
    });

    return NextResponse.json({
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
    });
  } catch (error) {
    console.error("POST /api/payments/create-intent error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
