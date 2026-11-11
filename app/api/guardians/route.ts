import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { getGuardianOptions } from "@/lib/db/household";

export const dynamic = "force-dynamic";

/** Every guardian, with their family groups, for the student form. */
export async function GET() {
  try {
    const { response } = await requireAdmin();
    if (response) return response;
    return NextResponse.json({ data: await getGuardianOptions() });
  } catch (error) {
    console.error("GET /api/guardians error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
