import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { consumeAccountToken, resetPassword } from "@/lib/db/account";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { resetPasswordSchema } from "@/lib/validations/account";

/** Public. The emailed single-use token is the proof of identity. */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`reset:${clientIp(req.headers)}`, 10, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again in a few minutes." },
        { status: 429 }
      );
    }

    const parsed = resetPasswordSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const email = await consumeAccountToken("reset", parsed.data.token);
    if (!email) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Please request a new one." },
        { status: 400 }
      );
    }

    await resetPassword(email, await bcrypt.hash(parsed.data.password, 10));
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    console.error("POST /api/account/reset-password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
