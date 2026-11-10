import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { runBillingJobs } from "@/lib/payment-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Nightly billing job (see vercel.json): marks past-due invoices OVERDUE and
 * charges invoices on auto-pay. Vercel Cron authenticates with
 * `Authorization: Bearer $CRON_SECRET`; an admin can also trigger it while signed in.
 */
export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    const fromCron = !!secret && req.headers.get("authorization") === `Bearer ${secret}`;

    if (!fromCron) {
      const session = await getServerSession(authOptions);
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (!isAdmin(session)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const summary = await runBillingJobs();
    return NextResponse.json({ data: summary });
  } catch (error) {
    console.error("GET /api/cron/billing error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
