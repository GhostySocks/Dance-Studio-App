import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import {
  getBillingAccount,
  getUserBillingAccounts,
  updateBillingAccount,
  userOwnsBillingAccount,
  type BillingAccountRef,
} from "@/lib/db/billing-accounts";
import { billingAccountSchema, confirmAutoPaySchema } from "@/lib/validations/payment";

const notConfigured = () =>
  NextResponse.json({ error: "Online payments are not set up yet" }, { status: 500 });

/** Loads the account if the signed-in user is allowed to manage it. */
async function loadOwnedAccount(session: Session, ref: BillingAccountRef) {
  if (!(await userOwnsBillingAccount(session.user.id, ref))) return null;
  return getBillingAccount(ref);
}

/** Lists the billing accounts the signed-in user can put on auto-pay. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const accounts = await getUserBillingAccounts(session.user.id);
    return NextResponse.json({ data: accounts });
  } catch (error) {
    console.error("GET /api/payments/auto-pay error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Step 1 of opting in: creates a SetupIntent so the browser can save a card. */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = billingAccountSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const ref: BillingAccountRef = { type: parsed.data.accountType, id: parsed.data.accountId };

    const account = await loadOwnedAccount(session, ref);
    if (!account) {
      return NextResponse.json({ error: "Billing account not found" }, { status: 404 });
    }
    if (!stripe) return notConfigured();

    let customerId = account.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: account.name,
        email: session.user.email ?? undefined,
        metadata: { accountType: ref.type, accountId: ref.id },
      });
      customerId = customer.id;
      await updateBillingAccount(ref, { stripeCustomerId: customerId });
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      usage: "off_session",
      automatic_payment_methods: { enabled: true },
      metadata: { accountType: ref.type, accountId: ref.id },
    });

    return NextResponse.json(
      { data: { clientSecret: setupIntent.client_secret, setupIntentId: setupIntent.id } },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/payments/auto-pay error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Step 2 of opting in: verifies the SetupIntent with Stripe, then turns auto-pay on. */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = confirmAutoPaySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const ref: BillingAccountRef = { type: parsed.data.accountType, id: parsed.data.accountId };

    const account = await loadOwnedAccount(session, ref);
    if (!account) {
      return NextResponse.json({ error: "Billing account not found" }, { status: 404 });
    }
    if (!stripe) return notConfigured();

    const setupIntent = await stripe.setupIntents.retrieve(parsed.data.setupIntentId);
    const paymentMethodId =
      typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method?.id;

    if (
      setupIntent.status !== "succeeded" ||
      !paymentMethodId ||
      !account.stripeCustomerId ||
      setupIntent.customer !== account.stripeCustomerId
    ) {
      return NextResponse.json({ error: "Card could not be verified" }, { status: 400 });
    }

    await updateBillingAccount(
      ref,
      { stripePaymentMethodId: paymentMethodId, autoPayEnabled: true },
      { actorId: session.user.id, action: "AUTOPAY_ENABLED" }
    );

    return NextResponse.json({ data: { autoPayEnabled: true } });
  } catch (error) {
    console.error("PUT /api/payments/auto-pay error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Opts out: turns auto-pay off and removes the saved card. */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = billingAccountSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const ref: BillingAccountRef = { type: parsed.data.accountType, id: parsed.data.accountId };

    const account = await loadOwnedAccount(session, ref);
    if (!account) {
      return NextResponse.json({ error: "Billing account not found" }, { status: 404 });
    }

    await updateBillingAccount(
      ref,
      { stripePaymentMethodId: null, autoPayEnabled: false },
      { actorId: session.user.id, action: "AUTOPAY_DISABLED", reason: "Turned off by user" }
    );

    if (stripe && account.stripePaymentMethodId) {
      try {
        await stripe.paymentMethods.detach(account.stripePaymentMethodId);
      } catch (error) {
        // Auto-pay is already off in our database; a leftover card at Stripe is harmless
        console.error("Could not detach payment method:", error);
      }
    }

    return NextResponse.json({ data: { autoPayEnabled: false } });
  } catch (error) {
    console.error("DELETE /api/payments/auto-pay error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
