import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import {
  handleAutoPayCancelled,
  settlePaymentFailed,
  settlePaymentSucceeded,
} from "@/lib/payment-service";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }
  if (!stripe || !webhookSecret) {
    console.error("Stripe webhook received but Stripe is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("Stripe webhook signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        // Marks Payment + Invoice PAID and emails the receipt (once)
        await settlePaymentSucceeded(event.data.object.id);
        break;
      }

      case "payment_intent.payment_failed": {
        // Marks Payment FAILED and emails the payer (once)
        await settlePaymentFailed(event.data.object.id);
        break;
      }

      case "customer.subscription.deleted": {
        const customer = event.data.object.customer;
        const customerId = typeof customer === "string" ? customer : customer.id;
        await handleAutoPayCancelled(customerId, "Stripe subscription cancelled");
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`Stripe webhook handler error (${event.type}):`, error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
