import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

import { getPublicSession } from "@/lib/db/public";
import { enrollStudent } from "@/lib/db/enrollment";
import {
  createFamilyAccount,
  createStudentAccount,
  isEmailRegistered,
} from "@/lib/db/registration";
import { createRegistration, getRegistrationOptions } from "@/lib/db/registrations";
import {
  sendEnrollmentConfirmation,
  sendRegistrationConfirmation,
  sendVerificationEmail,
} from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { registrationSchema } from "@/lib/validations/registration";

const EMAIL_TAKEN = "An account with this email already exists. Sign in instead.";

/**
 * Public sign-up. There is no session to check: this only ever creates a new
 * PARENT or STUDENT account, never a privileged one, and the role is decided here.
 */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`register:${clientIp(req.headers)}`, 5, 10 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again in a few minutes." },
        { status: 429 }
      );
    }

    const parsed = registrationSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid registration details" },
        { status: 400 }
      );
    }
    const data = parsed.data;

    if (data.sessionId) {
      const classSession = await getPublicSession(data.sessionId);
      if (!classSession || !classSession.template.dropInEnabled) {
        return NextResponse.json(
          { error: "That class is no longer available. Please pick another one." },
          { status: 400 }
        );
      }
    }

    if (data.termChoice) {
      const options = await getRegistrationOptions(data.termChoice.templateId);
      const term = options?.terms.find((t) => t.termId === data.termChoice?.termId);
      if (!term?.plans.some((p) => p.plan === data.termChoice?.plan)) {
        return NextResponse.json(
          { error: "That registration option is no longer available. Please pick another one." },
          { status: 400 }
        );
      }
    }

    if (await isEmailRegistered(data.email)) {
      return NextResponse.json({ error: EMAIL_TAKEN }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    let account: { userId: string; studentIds: string[] };
    try {
      account =
        data.accountType === "PARENT"
          ? await createFamilyAccount({ ...data, passwordHash })
          : await createStudentAccount({ ...data, passwordHash });
    } catch (error) {
      // Two sign-ups with the same email at the same moment
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return NextResponse.json({ error: EMAIL_TAKEN }, { status: 409 });
      }
      throw error;
    }

    await sendVerificationEmail(data.email);

    // Enroll in the class picked on the way in. The account already exists, so a
    // failure here is reported rather than failing the whole sign-up.
    let enrolled = 0;
    let waitlisted = 0;
    if (data.sessionId) {
      const toEnroll =
        data.accountType === "PARENT"
          ? account.studentIds.filter((_, i) => data.dancers[i]?.enroll)
          : account.studentIds;

      for (const studentId of toEnroll) {
        const result = await enrollStudent({ studentId, sessionId: data.sessionId });
        if (result.success && result.enrollment) {
          if (result.waitlist) waitlisted += 1;
          else enrolled += 1;
          await sendEnrollmentConfirmation(result.enrollment.id);
        }
      }
    }

    // Or register for the whole term
    if (data.termChoice) {
      const toRegister =
        data.accountType === "PARENT"
          ? account.studentIds.filter((_, i) => data.dancers[i]?.enroll)
          : account.studentIds;

      for (const studentId of toRegister) {
        const result = await createRegistration({
          studentId,
          ...data.termChoice,
          actorId: account.userId,
        });
        if (result.ok) {
          if (result.enrolled > 0) enrolled += 1;
          else waitlisted += 1;
          await sendRegistrationConfirmation(result.registrationId);
        }
      }
    }

    return NextResponse.json({ data: { enrolled, waitlisted } }, { status: 201 });
  } catch (error) {
    console.error("POST /api/register error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
