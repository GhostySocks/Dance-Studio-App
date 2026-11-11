import { NextRequest, NextResponse } from "next/server";
import { requireAttendanceAccess } from "@/lib/attendance-access";
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
    // Admins, or the instructor who teaches this class
    const { response } = await requireAttendanceAccess(params.sessionId);
    if (response) return response;

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
    // Admins, or the instructor who teaches this class
    const { response } = await requireAttendanceAccess(params.sessionId);
    if (response) return response;

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
