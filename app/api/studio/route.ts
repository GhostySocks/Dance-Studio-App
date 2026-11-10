import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getStudioSettings, updateStudioSettings } from "@/lib/db/studio";
import { isAdmin } from "@/lib/permissions";
import { studioSchema } from "@/lib/validations/account";

// Reads the session cookie, so it can never be prerendered
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdmin(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ data: await getStudioSettings() });
  } catch (error) {
    console.error("GET /api/studio error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdmin(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = studioSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid settings" },
        { status: 400 }
      );
    }

    const studio = await updateStudioSettings(parsed.data, session.user.id);
    return NextResponse.json({ data: studio });
  } catch (error) {
    console.error("PUT /api/studio error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
