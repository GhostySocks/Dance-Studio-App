import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getAccountById } from "@/lib/db/account";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

/** Whether the signed-in user's email address is confirmed. */
// Reads the session cookie, so it can never be prerendered
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const account = await getAccountById(session.user.id);
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    return NextResponse.json({ data: { verified: !!account.emailVerified } });
  } catch (error) {
    console.error("GET /api/account/verify-email error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Re-sends the confirmation link to the signed-in user. */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!rateLimit(`verify:${session.user.id}`, 3, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "We already sent a few links. Please check your inbox, or try again later." },
        { status: 429 }
      );
    }

    const account = await getAccountById(session.user.id);
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    if (!account.emailVerified) await sendVerificationEmail(account.email);

    return NextResponse.json({ data: { verified: !!account.emailVerified } });
  } catch (error) {
    console.error("POST /api/account/verify-email error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
