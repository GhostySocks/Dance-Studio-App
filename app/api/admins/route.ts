import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { isEmailRegistered } from "@/lib/db/registration";
import { createAdminAccount, getAdmins } from "@/lib/db/staff";
import { EMAIL_IN_USE, inviteStaff, isDuplicateEmail } from "@/lib/staff-api";
import { newAdminSchema } from "@/lib/validations/staff";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { response } = await requireAdmin();
    if (response) return response;
    return NextResponse.json({ data: await getAdmins() });
  } catch (error) {
    console.error("GET /api/admins error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** An administrator adds another administrator, who sets their own password by link. */
export async function POST(req: NextRequest) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const parsed = newAdminSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid details" },
        { status: 400 }
      );
    }
    if (await isEmailRegistered(parsed.data.email)) {
      return NextResponse.json({ error: EMAIL_IN_USE }, { status: 409 });
    }

    let created;
    try {
      created = await createAdminAccount(parsed.data, session.user.id);
    } catch (error) {
      if (isDuplicateEmail(error)) {
        return NextResponse.json({ error: EMAIL_IN_USE }, { status: 409 });
      }
      throw error;
    }

    const invite = await inviteStaff(created.user, "an administrator");
    return NextResponse.json({ data: { id: created.user.id, ...invite } }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admins error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
