import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { mapWithLimit } from "@/lib/billing-period";
import { markDraftInvoicesSent } from "@/lib/db/invoices";
import { sendInvoiceEmail } from "@/lib/email";
import { sendInvoicesSchema } from "@/lib/validations/invoice";

/** Emails are sent a few at a time so a large batch does not swamp the provider or the database pool. */
const EMAIL_CONCURRENCY = 3;

/** Sends the chosen draft invoices, or every draft invoice when no ids are given. */
export async function POST(req: NextRequest) {
  try {
    const { session, response } = await requireAdmin();
    if (!session) return response;

    const parsed = sendInvoicesSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Choose the invoices to send" }, { status: 400 });
    }

    const { sentIds, skipped } = await markDraftInvoicesSent({
      ids: parsed.data.ids,
      actorId: session.user.id,
    });

    const emails = await mapWithLimit(sentIds, EMAIL_CONCURRENCY, (id) => sendInvoiceEmail(id, "sent"));
    const emailed = emails.filter((e) => e.sent).length;

    return NextResponse.json({ data: { sent: sentIds.length, emailed, skipped } });
  } catch (error) {
    console.error("POST /api/invoices/send error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
