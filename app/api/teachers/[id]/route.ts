import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/api-auth";
import { countUpcomingSessions, removeTeacher } from "@/lib/db/staff";
import { getTeacherById, updateTeacher } from "@/lib/db/teachers";
import { removeTeacherSchema } from "@/lib/validations/staff";
import { parseSpecialties, teacherProfileFormSchema } from "@/lib/validations/staff";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Includes the teacher's email and phone, so not for parents or students
    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const teacher = await getTeacherById(params.id);
    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    const upcomingCount = await countUpcomingSessions(teacher.id);
    return NextResponse.json({ data: { ...teacher, upcomingCount } });
  } catch (error) {
    console.error("GET /api/teachers/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = teacherProfileFormSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid details" },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const teacher = await updateTeacher(params.id, {
      bio: data.bio || null,
      specialties: parseSpecialties(data.specialties),
      phone: data.phone || null,
    });

    return NextResponse.json({ data: teacher });
  } catch (error) {
    console.error("PUT /api/teachers/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Removes a teacher. Classes they were still due to teach are handed to
 * `reassignTo`; their past classes stay on record under their name.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const parsed = removeTeacherSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const result = await removeTeacher(params.id, parsed.data.reassignTo ?? null, session.user.id);
    switch (result.status) {
      case "not-found":
        return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
      case "needs-reassign":
        return NextResponse.json(
          { error: "Choose a teacher to take over their upcoming classes." },
          { status: 400 }
        );
      case "bad-reassign":
        return NextResponse.json(
          { error: "Choose a different, current teacher to take over the classes." },
          { status: 400 }
        );
      default:
        return NextResponse.json({ data: { removed: true, reassigned: result.reassigned } });
    }
  } catch (error) {
    console.error("DELETE /api/teachers/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
