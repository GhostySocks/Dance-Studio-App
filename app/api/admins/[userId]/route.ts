import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { removeAdmin } from "@/lib/db/staff";

/** Removes an administrator's access. */
export async function DELETE(_req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const result = await removeAdmin(params.userId, session.user.id);
    switch (result) {
      case "not-found":
        return NextResponse.json({ error: "Administrator not found" }, { status: 404 });
      case "self":
        return NextResponse.json(
          { error: "You cannot remove yourself. Ask another administrator to do it." },
          { status: 400 }
        );
      case "owner":
        return NextResponse.json({ error: "The studio owner cannot be removed." }, { status: 400 });
      default:
        return NextResponse.json({ data: { removed: true } });
    }
  } catch (error) {
    console.error("DELETE /api/admins/[userId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
