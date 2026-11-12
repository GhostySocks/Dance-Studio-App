import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/api-auth";
import { getStudents } from "@/lib/db/students";
import { saveStudent } from "@/lib/student-api";
import { studentSchema } from "@/lib/validations/student";

export async function GET(req: NextRequest) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? undefined;
    const page = parseInt(searchParams.get("page") ?? "1");
    const perPage = parseInt(searchParams.get("perPage") ?? "10");

    const result = await getStudents({ search, page, perPage });
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("GET /api/students error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = studentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid student details" },
        { status: 400 }
      );
    }

    // Creates the student with any new guardian and family group in one step
    return await saveStudent(parsed.data, session.user.id);
  } catch (error) {
    console.error("POST /api/students error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
