import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/api-auth";
import { createTeacherAccount, findAccountByEmail, reactivateTeacher } from "@/lib/db/staff";
import { getTeachers } from "@/lib/db/teachers";
import { EMAIL_IN_USE, inviteStaff, isDuplicateEmail } from "@/lib/staff-api";
import { newTeacherSchema, parseSpecialties } from "@/lib/validations/staff";

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

/** An administrator adds a teacher, who sets their own password by link. */
export async function POST(req: NextRequest) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const parsed = newTeacherSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid details" },
        { status: 400 }
      );
    }
    const { specialties, ...data } = parsed.data;
    const profile = { ...data, specialties: parseSpecialties(specialties) };

    const existing = await findAccountByEmail(data.email);
    if (existing) {
      // A teacher who was removed earlier comes back with their history
      if (!(existing.disabledAt && existing.role === "TEACHER" && existing.teacher)) {
        return NextResponse.json({ error: EMAIL_IN_USE }, { status: 409 });
      }
      const restored = await reactivateTeacher(existing.id, profile, session.user.id);
      const invite = await inviteStaff(restored.user, "a teacher");
      return NextResponse.json({ data: { id: restored.teacherId, ...invite } }, { status: 201 });
    }

    let created;
    try {
      created = await createTeacherAccount(profile, session.user.id);
    } catch (error) {
      if (isDuplicateEmail(error)) {
        return NextResponse.json({ error: EMAIL_IN_USE }, { status: 409 });
      }
      throw error;
    }

    const invite = await inviteStaff(created.user, "a teacher");
    return NextResponse.json({ data: { id: created.teacherId, ...invite } }, { status: 201 });
  } catch (error) {
    console.error("POST /api/teachers error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
