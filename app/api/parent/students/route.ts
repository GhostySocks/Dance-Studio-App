import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getParentStudents } from "@/lib/db/payments";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const students = await getParentStudents(session.user.id);
    return NextResponse.json({ data: students });
  } catch (error) {
    console.error("GET /api/parent/students error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
