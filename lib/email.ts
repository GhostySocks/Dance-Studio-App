import { Resend } from "resend";
import type { ReactElement } from "react";

import EnrollmentConfirmationEmail from "@/emails/enrollment-confirmation";
import InvoiceEmail, { type InvoiceEmailProps } from "@/emails/invoice";
import AdminNoticeEmail from "@/emails/admin-notice";
import TeacherMessageEmail from "@/emails/teacher-message";
import RegistrationConfirmationEmail from "@/emails/registration-confirmation";
import { getRegistrationEmailContext } from "@/lib/db/registrations";
import { PLAN_LABELS, PLAN_UNITS } from "@/lib/registration-billing";
import AccountLinkEmail, { type AccountLinkEmailProps } from "@/emails/account-link";
import { createAccountToken } from "@/lib/db/account";
import {
  getAdminEmails,
  getEnrollmentEmailContext,
  getInvoiceEmailContext,
  getStudioInfo,
} from "@/lib/db/recipients";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

let client: Resend | null | undefined;

function getResend(): Resend | null {
  if (client !== undefined) return client;
  const key = process.env.RESEND_API_KEY;
  client = !key || key === "re_..." ? null : new Resend(key);
  if (!client) {
    console.warn("RESEND_API_KEY is not configured. Emails will be skipped.");
  }
  return client;
}

/**
 * Sends one email. Never throws: email is a side effect and must not fail the
 * operation (enrollment, payment, webhook) that triggered it.
 */
export async function sendEmail({
  to,
  subject,
  react,
  replyTo,
}: {
  to: string[];
  subject: string;
  react: ReactElement;
  /** Where replies should go, when not back to the studio. */
  replyTo?: string;
}): Promise<{ sent: boolean }> {
  if (to.length === 0) return { sent: false };

  const resend = getResend();
  const from = process.env.EMAIL_FROM;
  if (!resend || !from) return { sent: false };

  try {
    const { error } = await resend.emails.send({ from, to, subject, react, replyTo });
    if (error) {
      console.error(`Email "${subject}" failed:`, error.message);
      return { sent: false };
    }
    return { sent: true };
  } catch (error) {
    console.error(`Email "${subject}" failed:`, error);
    return { sent: false };
  }
}

function billingUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "";
  return `${base.replace(/\/$/, "")}/parent/billing`;
}

export async function sendEnrollmentConfirmation(enrollmentId: string) {
  try {
    const [ctx, studio] = await Promise.all([
      getEnrollmentEmailContext(enrollmentId),
      getStudioInfo(),
    ]);
    if (!ctx || ctx.enrollment.status === "CANCELLED") return { sent: false };

    const { enrollment } = ctx;
    const studentName = `${enrollment.student.firstName} ${enrollment.student.lastName}`;
    const className = enrollment.session.template.name;
    const waitlisted = enrollment.status === "WAITLIST";

    return await sendEmail({
      to: ctx.recipients,
      subject: waitlisted
        ? `Waitlist: ${studentName} — ${className}`
        : `Enrollment confirmed: ${studentName} — ${className}`,
      react: EnrollmentConfirmationEmail({
        studioName: studio.name,
        recipientName: ctx.recipientName,
        studentName,
        className,
        teacherName: enrollment.session.teacher.user.name,
        roomName: enrollment.session.room.name,
        startsAt: formatDateTime(enrollment.session.startTime, studio.timezone),
        waitlisted,
      }),
    });
  } catch (error) {
    console.error("sendEnrollmentConfirmation failed:", error);
    return { sent: false };
  }
}

const invoiceSubjects: Record<InvoiceEmailProps["kind"], string> = {
  sent: "Your invoice is ready",
  receipt: "Payment receipt",
  failed: "Payment failed — action needed",
};

/** Emails the payer(s) of an invoice: new invoice, receipt, or failed payment. */
export async function sendInvoiceEmail(invoiceId: string, kind: InvoiceEmailProps["kind"]) {
  try {
    const [ctx, studio] = await Promise.all([
      getInvoiceEmailContext(invoiceId),
      getStudioInfo(),
    ]);
    if (!ctx) return { sent: false };

    const { invoice } = ctx;
    return await sendEmail({
      to: ctx.recipients,
      subject: `${invoiceSubjects[kind]} — ${studio.name}`,
      react: InvoiceEmail({
        studioName: studio.name,
        kind,
        billTo: ctx.billTo,
        period: `${formatDate(invoice.periodStart, studio.timezone)} – ${formatDate(invoice.periodEnd, studio.timezone)}`,
        dueDate: invoice.dueDate ? formatDate(invoice.dueDate, studio.timezone) : null,
        total: formatCurrency(invoice.totalCents),
        lines: invoice.lineItems.map((l) => ({
          id: l.id,
          description: l.description,
          amount: formatCurrency(l.amountCents),
        })),
        payUrl: billingUrl(),
      }),
    });
  } catch (error) {
    console.error(`sendInvoiceEmail(${kind}) failed:`, error);
    return { sent: false };
  }
}

export async function sendAdminNotice(heading: string, message: string) {
  try {
    const [to, studio] = await Promise.all([getAdminEmails(), getStudioInfo()]);
    return await sendEmail({
      to,
      subject: `${heading} — ${studio.name}`,
      react: AdminNoticeEmail({ studioName: studio.name, heading, message }),
    });
  } catch (error) {
    console.error("sendAdminNotice failed:", error);
    return { sent: false };
  }
}

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "";
  return `${base.replace(/\/$/, "")}${path}`;
}

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const VERIFY_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/**
 * Sends an account link. With no email provider configured in development, the link
 * is printed to the server log instead so the flow can still be exercised.
 */
async function sendAccountLink(to: string, subject: string, props: Omit<AccountLinkEmailProps, "studioName">) {
  const studio = await getStudioInfo();
  const result = await sendEmail({
    to: [to],
    subject: `${subject} — ${studio.name}`,
    react: AccountLinkEmail({ studioName: studio.name, ...props }),
  });
  if (!result.sent && process.env.NODE_ENV !== "production") {
    console.info(`[dev] Email not sent. ${subject} link: ${props.url}`);
  }
  return result;
}

export async function sendPasswordResetEmail(email: string) {
  try {
    const token = await createAccountToken("reset", email, RESET_TTL_MS);
    return await sendAccountLink(email, "Reset your password", {
      heading: "Reset your password",
      message: "We received a request to reset the password for your account.",
      buttonLabel: "Choose a new password",
      url: appUrl(`/reset-password?token=${token}`),
      footnote:
        "This link works once and expires in 1 hour. If you did not ask for it, you can ignore this email and your password will stay the same.",
    });
  } catch (error) {
    console.error("sendPasswordResetEmail failed:", error);
    return { sent: false };
  }
}

export async function sendVerificationEmail(email: string) {
  try {
    const token = await createAccountToken("verify", email, VERIFY_TTL_MS);
    return await sendAccountLink(email, "Confirm your email address", {
      heading: "Confirm your email address",
      message: "Please confirm this is your email address so we can send you invoices and class updates.",
      buttonLabel: "Confirm email",
      url: appUrl(`/verify-email?token=${token}`),
      footnote: "This link expires in 3 days. If you did not create an account, you can ignore this email.",
    });
  } catch (error) {
    console.error("sendVerificationEmail failed:", error);
    return { sent: false };
  }
}

/** One email for a whole term registration, instead of one per class date. */
export async function sendRegistrationConfirmation(registrationId: string) {
  try {
    const [ctx, studio] = await Promise.all([
      getRegistrationEmailContext(registrationId),
      getStudioInfo(),
    ]);
    if (!ctx || ctx.registration.status === "CANCELLED") return { sent: false };

    const { registration } = ctx;
    const studentName = `${registration.student.firstName} ${registration.student.lastName}`;
    const className = registration.template.name;
    const covers = registration.season?.name ?? registration.term?.name ?? "the term";
    const confirmed = registration.enrollments.filter((e) => e.status === "ACTIVE");
    const waitlisted = registration.enrollments.length - confirmed.length;
    const first = confirmed[0]?.session.startTime ?? null;

    return await sendEmail({
      to: ctx.recipients,
      subject: `Registration: ${studentName} — ${className} (${covers})`,
      react: RegistrationConfirmationEmail({
        studioName: studio.name,
        recipientName: ctx.recipientName,
        studentName,
        className,
        covers,
        billing: `${PLAN_LABELS[registration.plan]} — ${formatCurrency(registration.priceCents)} ${PLAN_UNITS[registration.plan]}`,
        confirmedDates: confirmed.length,
        waitlistedDates: waitlisted,
        firstDate: first ? formatDateTime(first, studio.timezone) : null,
      }),
    });
  } catch (error) {
    console.error("sendRegistrationConfirmation failed:", error);
    return { sent: false };
  }
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Emails a staff member a single-use link to set their password and sign in.
 * Also returns the link, so that when email is not configured an admin can pass
 * it on themselves. Used for new staff and for "send a sign-in link" later.
 */
export async function sendStaffInvite(user: { email: string; name: string }, roleLabel: string) {
  const token = await createAccountToken("reset", user.email, INVITE_TTL_MS);
  const url = appUrl(`/reset-password?token=${token}`);
  try {
    const studio = await getStudioInfo();
    const result = await sendAccountLink(user.email, "Set up your account", {
      heading: `Welcome to ${studio.name}`,
      message: `Hi ${user.name}, you have been added as ${roleLabel}. Choose a password to finish setting up your account.`,
      buttonLabel: "Set my password",
      url,
      footnote:
        "This link works once and expires in 7 days. After that, use Forgot password on the sign-in page.",
    });
    return { sent: result.sent, url };
  } catch (error) {
    console.error("sendStaffInvite failed:", error);
    return { sent: false, url };
  }
}

/** Delivers a parent's or student's message to their teacher. Replies go to the sender. */
export async function sendTeacherMessage(
  context: {
    sender: { name: string; email: string };
    teacher: { name: string; email: string };
    links: string[];
  },
  subject: string,
  message: string
) {
  try {
    const studio = await getStudioInfo();
    return await sendEmail({
      to: [context.teacher.email],
      replyTo: context.sender.email,
      subject: `${subject} — from ${context.sender.name}`,
      react: TeacherMessageEmail({
        studioName: studio.name,
        teacherName: context.teacher.name,
        senderName: context.sender.name,
        senderEmail: context.sender.email,
        links: context.links,
        subject,
        message,
      }),
    });
  } catch (error) {
    console.error("sendTeacherMessage failed:", error);
    return { sent: false };
  }
}
