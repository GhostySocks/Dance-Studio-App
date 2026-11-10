import { NextRequest, NextResponse } from "next/server";

import { getAccountByEmail } from "@/lib/db/account";
import { sendPasswordResetEmail } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { forgotPasswordSchema } from "@/lib/validations/account";

/**
 * Public. Always answers the same way whether or not the account exists, so this
 * endpoint cannot be used to discover who has an account.
 */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`forgot:${clientIp(req.headers)}`, 5, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again in a few minutes." },
        { status: 429 }
      );
    }

    const parsed = forgotPasswordSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }

    // At most 3 emails per address per hour, however many IPs ask
    if (rateLimit(`forgot-email:${parsed.data.email}`, 3, 60 * 60 * 1000)) {
      const account = await getAccountByEmail(parsed.data.email);
      if (account) await sendPasswordResetEmail(account.email);
    }

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    console.error("POST /api/account/forgot-password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
