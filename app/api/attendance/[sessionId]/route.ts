import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getOrCreateSessionAttendance,
  markAttendance,
  batchMarkAttendance,
} from "@/lib/db/attendance";
import {
  markAttendanceSchema,
  batchAttendanceSchema,
} from "@/lib/validations/attendance";

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const records = await getOrCreateSessionAttendance(params.sessionId);
    return NextResponse.json({ data: records });
  } catch (error) {
    console.error("GET /api/attendance/[sessionId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Teachers and admins can mark attendance
    if (!["SUPER_ADMIN", "ADMIN", "TEACHER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    // Check if batch or single
    if (body.records) {
      const parsed = batchAttendanceSchema.safeParse({
        ...body,
        sessionId: params.sessionId,
      });
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const result = await batchMarkAttendance(parsed.data);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 409 });
      }
      return NextResponse.json({ data: result.records });
    }

    const parsed = markAttendanceSchema.safeParse({
      ...body,
      sessionId: params.sessionId,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await markAttendance(parsed.data);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({ data: result.record });
  } catch (error) {
    console.error("PUT /api/attendance/[sessionId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
