import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getParentSchedule } from "@/lib/db/payments";

// Reads the session cookie, so it can never be prerendered
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const schedule = await getParentSchedule(session.user.id);
    return NextResponse.json({ data: schedule });
  } catch (error) {
    console.error("GET /api/parent/schedule error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
