import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { getStaffUser } from "@/lib/db/staff";
import { rateLimit } from "@/lib/rate-limit";
import { inviteStaff } from "@/lib/staff-api";

/** Sends a teacher or administrator a fresh link to set their password and sign in. */
export async function POST(_req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const user = await getStaffUser(params.userId);
    if (!user) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }
    if (!rateLimit(`staff-invite:${user.id}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Several links were already sent in the last hour. Please try again later." },
        { status: 429 }
      );
    }

    const invite = await inviteStaff(user, user.role === "TEACHER" ? "a teacher" : "an administrator");
    return NextResponse.json({ data: invite });
  } catch (error) {
    console.error("POST /api/staff/[userId]/invite error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
