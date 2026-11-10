"use client";

import { useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const isConfigured = /^pk_(test|live)_\w{8,}/.test(publishableKey);

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe() {
  if (!stripePromise) stripePromise = loadStripe(publishableKey);
  return stripePromise;
}

interface StripeCardFormProps {
  clientSecret: string;
  /** "payment" charges the card now; "setup" saves it for future auto-pay charges. */
  mode: "payment" | "setup";
  submitLabel: string;
  /** Called with the PaymentIntent or SetupIntent id once Stripe confirms. */
  onSuccess: (intentId: string) => Promise<void> | void;
}

function CardForm({ mode, submitLabel, onSuccess }: Omit<StripeCardFormProps, "clientSecret">) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const options = {
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required" as const,
    };

    try {
      if (mode === "payment") {
        const { error: stripeError, paymentIntent } = await stripe.confirmPayment(options);
        if (stripeError) throw new Error(stripeError.message ?? "Payment failed");
        if (paymentIntent) await onSuccess(paymentIntent.id);
      } else {
        const { error: stripeError, setupIntent } = await stripe.confirmSetup(options);
        if (stripeError) throw new Error(stripeError.message ?? "Card could not be saved");
        if (setupIntent) await onSuccess(setupIntent.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={!stripe || submitting}>
        {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  );
}

export function StripeCardForm({ clientSecret, ...rest }: StripeCardFormProps) {
  if (!isConfigured) {
    return (
      <p className="text-sm text-muted-foreground">
        Online card payments aren&apos;t set up for this studio yet. Please contact the studio to
        pay.
      </p>
    );
  }

  return (
    <Elements stripe={getStripe()} options={{ clientSecret }}>
      <CardForm {...rest} />
    </Elements>
  );
}
