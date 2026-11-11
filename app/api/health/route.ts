import { NextResponse } from "next/server";

import { pingDatabase } from "@/lib/db/system";

export const dynamic = "force-dynamic";

/**
 * Health check for the hosting platform. Public and deliberately tells nothing
 * beyond up/down. It includes the database, so a deploy with a bad DATABASE_URL
 * fails its health check instead of replacing a working version.
 */
export async function GET() {
  try {
    await pingDatabase();
    return NextResponse.json({ data: { status: "ok" } });
  } catch (error) {
    console.error("GET /api/health error:", error);
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
}
