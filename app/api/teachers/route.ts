import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTeachers } from "@/lib/db/teachers";

// Reads the session cookie, so it can never be prerendered
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? undefined;
    const page = parseInt(searchParams.get("page") ?? "1");
    const perPage = parseInt(searchParams.get("perPage") ?? "10");

    const result = await getTeachers({ search, page, perPage });
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("GET /api/teachers error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
