import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { cancelRegistration } from "@/lib/db/registrations";

/**
 * Cancels a registration from now on (admin only): future dates are released and
 * no further instalments are charged. Anything already invoiced is unchanged.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const result = await cancelRegistration(params.id, session.user.id);
    if (!result) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("DELETE /api/registrations/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
