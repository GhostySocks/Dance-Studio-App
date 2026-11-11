import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { getUpcomingSessionsForClass } from "@/lib/db/classes";
import { getRegistrationOptions } from "@/lib/db/registrations";

export const dynamic = "force-dynamic";

/**
 * What a student can be enrolled in for one class: the terms and billing options
 * on offer, and the individual upcoming dates. Used by the admin Enroll dialog.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const [options, sessions] = await Promise.all([
      getRegistrationOptions(params.id),
      getUpcomingSessionsForClass(params.id),
    ]);
    if (!options) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }
    return NextResponse.json({ data: { terms: options.terms, sessions } });
  } catch (error) {
    console.error("GET /api/classes/[id]/registration-options error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
