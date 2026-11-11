import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { getStudioInfo } from "@/lib/db/recipients";
import { createTerm, getTermsAndSeasons, seasonExists } from "@/lib/db/terms";
import { endOfDayIn, startOfDayIn } from "@/lib/timezone";
import { termSchema } from "@/lib/validations/term";

export const dynamic = "force-dynamic";

/** Terms and seasons, with the studio timezone their dates are expressed in. */
export async function GET() {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const [data, studio] = await Promise.all([getTermsAndSeasons(), getStudioInfo()]);
    return NextResponse.json({ data: { ...data, timezone: studio.timezone } });
  } catch (error) {
    console.error("GET /api/terms error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const parsed = termSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid term" },
        { status: 400 }
      );
    }
    const { name, startDate, endDate, seasonId } = parsed.data;
    if (seasonId && !(await seasonExists(seasonId))) {
      return NextResponse.json({ error: "Season not found" }, { status: 400 });
    }

    // Dates are calendar days in the studio's timezone
    const { timezone } = await getStudioInfo();
    const term = await createTerm({
      name,
      startDate: startOfDayIn(timezone, startDate),
      endDate: endOfDayIn(timezone, endDate),
      seasonId: seasonId || null,
    });
    return NextResponse.json({ data: term }, { status: 201 });
  } catch (error) {
    console.error("POST /api/terms error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
