import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { getStudioInfo } from "@/lib/db/recipients";
import { createSeason } from "@/lib/db/terms";
import { endOfDayIn, startOfDayIn } from "@/lib/timezone";
import { seasonSchema } from "@/lib/validations/term";

export async function POST(req: NextRequest) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const parsed = seasonSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid season" },
        { status: 400 }
      );
    }

    const { timezone } = await getStudioInfo();
    const season = await createSeason({
      name: parsed.data.name,
      startDate: startOfDayIn(timezone, parsed.data.startDate),
      endDate: endOfDayIn(timezone, parsed.data.endDate),
    });
    return NextResponse.json({ data: season }, { status: 201 });
  } catch (error) {
    console.error("POST /api/seasons error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
