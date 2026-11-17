import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getPortalClassBrowser } from "@/lib/db/portal-schedule";
import { isPortalUser } from "@/lib/permissions";

// Reads the session cookie, so it can never be prerendered
export const dynamic = "force-dynamic";

/** Every upcoming class, with the signed-in family's own bookings and makeups marked. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isPortalUser(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ data: await getPortalClassBrowser(session.user.id) });
  } catch (error) {
    console.error("GET /api/portal/schedule error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
