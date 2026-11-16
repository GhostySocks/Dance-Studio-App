import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { deleteClosure } from "@/lib/db/closures";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const removed = await deleteClosure(params.id, session.user.id);
    if (!removed) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error("DELETE /api/closures/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
