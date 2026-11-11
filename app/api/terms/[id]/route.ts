import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { getStudioInfo } from "@/lib/db/recipients";
import { deleteTerm, seasonExists, termExists, updateTerm } from "@/lib/db/terms";
import { endOfDayIn, startOfDayIn } from "@/lib/timezone";
import { termSchema } from "@/lib/validations/term";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
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
    if (!(await termExists(params.id))) {
      return NextResponse.json({ error: "Term not found" }, { status: 404 });
    }
    const { name, startDate, endDate, seasonId } = parsed.data;
    if (seasonId && !(await seasonExists(seasonId))) {
      return NextResponse.json({ error: "Season not found" }, { status: 400 });
    }

    const { timezone } = await getStudioInfo();
    const term = await updateTerm(params.id, {
      name,
      startDate: startOfDayIn(timezone, startDate),
      endDate: endOfDayIn(timezone, endDate),
      seasonId: seasonId || null,
    });
    return NextResponse.json({ data: term });
  } catch (error) {
    console.error("PUT /api/terms/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const result = await deleteTerm(params.id);
    if (result === "not-found") {
      return NextResponse.json({ error: "Term not found" }, { status: 404 });
    }
    if (result === "in-use") {
      return NextResponse.json(
        { error: "This term has registrations and cannot be deleted." },
        { status: 400 }
      );
    }
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error("DELETE /api/terms/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
