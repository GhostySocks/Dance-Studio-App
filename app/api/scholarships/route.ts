import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getScholarships, createScholarship } from "@/lib/db/invoices";
import { scholarshipSchema } from "@/lib/validations/invoice";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const result = await getScholarships({
      page: Number(searchParams.get("page") ?? 1),
      perPage: Number(searchParams.get("perPage") ?? 20),
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("GET /api/scholarships error:", error);
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
    const parsed = scholarshipSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const scholarship = await createScholarship({
      name: data.name,
      studentId: data.studentId || null,
      familyGroupId: data.familyGroupId || null,
      type: data.type,
      value: data.value,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      notes: data.notes || null,
    });

    return NextResponse.json({ data: scholarship }, { status: 201 });
  } catch (error) {
    console.error("POST /api/scholarships error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
