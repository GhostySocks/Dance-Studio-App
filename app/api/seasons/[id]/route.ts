import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { getStudioInfo } from "@/lib/db/recipients";
import { deleteSeason, seasonExists, updateSeason } from "@/lib/db/terms";
import { endOfDayIn, startOfDayIn } from "@/lib/timezone";
import { seasonSchema } from "@/lib/validations/term";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
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
    if (!(await seasonExists(params.id))) {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }

    const { timezone } = await getStudioInfo();
    const season = await updateSeason(params.id, {
      name: parsed.data.name,
      startDate: startOfDayIn(timezone, parsed.data.startDate),
      endDate: endOfDayIn(timezone, parsed.data.endDate),
    });
    return NextResponse.json({ data: season });
  } catch (error) {
    console.error("PUT /api/seasons/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const result = await deleteSeason(params.id);
    if (result === "not-found") {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }
    if (result === "in-use") {
      return NextResponse.json(
        { error: "This season has registrations and cannot be deleted." },
        { status: 400 }
      );
    }
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error("DELETE /api/seasons/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
