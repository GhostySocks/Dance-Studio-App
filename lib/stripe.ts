import Stripe from "stripe";

function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key === "sk_test_..." || key === "sk_live_...") {
    console.warn("STRIPE_SECRET_KEY is not configured. Stripe features will not work.");
    // Return a dummy that will fail at runtime, not at import time
    return null as unknown as Stripe;
  }
  return new Stripe(key);
}

export const stripe = getStripeClient();
