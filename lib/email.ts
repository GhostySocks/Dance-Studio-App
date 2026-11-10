import { Resend } from "resend";
import type { ReactElement } from "react";

import EnrollmentConfirmationEmail from "@/emails/enrollment-confirmation";
import InvoiceEmail, { type InvoiceEmailProps } from "@/emails/invoice";
import AdminNoticeEmail from "@/emails/admin-notice";
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
}: {
  to: string[];
  subject: string;
  react: ReactElement;
}): Promise<{ sent: boolean }> {
  if (to.length === 0) return { sent: false };

  const resend = getResend();
  const from = process.env.EMAIL_FROM;
  if (!resend || !from) return { sent: false };

  try {
    const { error } = await resend.emails.send({ from, to, subject, react });
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
