import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getParentStudents } from "@/lib/db/payments";
import { addChildForGuardian, countGuardianStudents } from "@/lib/db/registration";
import { hasRole } from "@/lib/permissions";
import { childSchema } from "@/lib/validations/account";

const MAX_CHILDREN = 12;

// Reads the session cookie, so it can never be prerendered
export const dynamic = "force-dynamic";

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

/** A parent adds a child to their own account. */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasRole(session, "PARENT")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = childSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid details" },
        { status: 400 }
      );
    }

    if ((await countGuardianStudents(session.user.id)) >= MAX_CHILDREN) {
      return NextResponse.json(
        { error: "You have reached the limit. Please contact the studio to add more." },
        { status: 400 }
      );
    }

    const student = await addChildForGuardian(session.user.id, parsed.data);
    if (!student) {
      return NextResponse.json({ error: "No parent profile found for your account" }, { status: 404 });
    }
    return NextResponse.json({ data: student }, { status: 201 });
  } catch (error) {
    console.error("POST /api/parent/students error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
