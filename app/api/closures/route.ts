import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { createClosure, getClosures } from "@/lib/db/closures";
import { getStudioInfo } from "@/lib/db/recipients";
import { closureSchema } from "@/lib/validations/closure";

export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Studio closures touching ?from= to ?to= (both optional "YYYY-MM-DD" days). */
export async function GET(req: NextRequest) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;
    if ((from && !DAY.test(from)) || (to && !DAY.test(to))) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    return NextResponse.json({ data: await getClosures({ from, to }) });
  } catch (error) {
    console.error("GET /api/closures error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const parsed = closureSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid closure" }, { status: 400 });
    }

    const { timezone } = await getStudioInfo();
    const result = await createClosure({ ...parsed.data, timeZone: timezone, actorId: session.user.id });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/closures error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
