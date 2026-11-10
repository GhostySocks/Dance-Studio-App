import Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { sendAdminNotice, sendInvoiceEmail } from "@/lib/email";
import { createPayment, markPaymentFailed, markPaymentPaid } from "@/lib/db/payments";
import {
  disableAutoPayByCustomer,
  getAutoPayDueInvoices,
  markOverdueInvoices,
} from "@/lib/db/billing-accounts";

/**
 * Records a successful PaymentIntent and emails the receipt once. Safe to call
 * more than once for the same intent (webhook + confirm endpoint + cron).
 */
export async function settlePaymentSucceeded(paymentIntentId: string) {
  const result = await markPaymentPaid(paymentIntentId);
  if (result?.newlyPaid && result.invoicePaid) {
    await sendInvoiceEmail(result.invoiceId, "receipt");
  }
  return result;
}

/** Records a failed PaymentIntent and emails the payer once. */
export async function settlePaymentFailed(paymentIntentId: string) {
  const result = await markPaymentFailed(paymentIntentId);
  if (result?.newlyFailed) {
    await sendInvoiceEmail(result.invoiceId, "failed");
  }
  return result;
}

/** Turns auto-pay off for a Stripe customer and tells the studio admins. */
export async function handleAutoPayCancelled(stripeCustomerId: string, reason: string) {
  const affected = await disableAutoPayByCustomer(stripeCustomerId, reason);
  if (affected.length > 0) {
    await sendAdminNotice(
      "Auto-pay was turned off",
      `Auto-pay has been disabled for ${affected.map((a) => a.name).join(", ")} (${reason}). Their future invoices will need to be paid manually.`
    );
  }
  return affected;
}

async function chargeInvoiceOffSession(invoice: {
  id: string;
  totalCents: number;
  stripeCustomerId: string;
  stripePaymentMethodId: string;
}): Promise<"paid" | "failed" | "pending"> {
  const day = new Date().toISOString().slice(0, 10);
  let intent: Stripe.PaymentIntent;

  try {
    intent = await stripe.paymentIntents.create(
      {
        amount: invoice.totalCents,
        currency: "usd",
        customer: invoice.stripeCustomerId,
        payment_method: invoice.stripePaymentMethodId,
        off_session: true,
        confirm: true,
        description: `Auto-pay for invoice ${invoice.id}`,
        metadata: { invoiceId: invoice.id, autoPay: "true" },
      },
      // One attempt per invoice per day, even if the job is triggered twice
      { idempotencyKey: `autopay-${invoice.id}-${day}` }
    );
  } catch (error) {
    // Declined cards throw, but Stripe still created a PaymentIntent we should record
    const failedIntent =
      error instanceof Stripe.errors.StripeError ? error.payment_intent : undefined;
    if (!failedIntent) throw error;

    await createPayment({
      invoiceId: invoice.id,
      amountCents: invoice.totalCents,
      stripePaymentIntentId: failedIntent.id,
    });
    await settlePaymentFailed(failedIntent.id);
    return "failed";
  }

  await createPayment({
    invoiceId: invoice.id,
    amountCents: invoice.totalCents,
    stripePaymentIntentId: intent.id,
  });

  if (intent.status === "succeeded") {
    await settlePaymentSucceeded(intent.id);
    return "paid";
  }
  // e.g. "processing" — the webhook settles it later
  return "pending";
}

/** Nightly job: flag overdue invoices, then charge invoices on auto-pay. */
export async function runBillingJobs() {
  const overdue = await markOverdueInvoices();

  const summary = { overdue, charged: 0, failed: 0, pending: 0, errors: 0 };
  if (!stripe) return { ...summary, autoPaySkipped: true };

  const due = await getAutoPayDueInvoices();
  for (const invoice of due) {
    try {
      const outcome = await chargeInvoiceOffSession(invoice);
      if (outcome === "paid") summary.charged += 1;
      else if (outcome === "failed") summary.failed += 1;
      else summary.pending += 1;
    } catch (error) {
      summary.errors += 1;
      console.error(`Auto-pay failed for invoice ${invoice.id}:`, error);
    }
  }

  return { ...summary, autoPaySkipped: false };
}
