import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/api-auth";
import { getClassSessions, createClassSession, createRecurringSessions } from "@/lib/db/classes";
import { checkRoomConflict } from "@/lib/db/rooms";
import { classSessionSchema } from "@/lib/validations/class";
import { syncRegistrationsForTemplate } from "@/lib/db/registrations";

export async function GET(req: NextRequest) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate") ?? undefined;
    const endDate = searchParams.get("endDate") ?? undefined;
    const teacherId = searchParams.get("teacherId") ?? undefined;
    const roomId = searchParams.get("roomId") ?? undefined;
    const result = await getClassSessions({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      teacherId: teacherId ?? undefined,
      roomId: roomId ?? undefined,
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("GET /api/sessions error:", error);
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
    const parsed = classSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const data = parsed.data;
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);

    const conflict = await checkRoomConflict(data.roomId, startTime, endTime);
    if (conflict) {
      return NextResponse.json(
        { error: "Room is already booked for this time" },
        { status: 409 }
      );
    }

    let result;
    if (data.isRecurring && data.weekCount && data.weekCount > 1) {
      result = await createRecurringSessions({
        ...data,
        startTime,
        endTime,
        weekCount: data.weekCount,
      });
    } else {
      // weekCount only applies to recurring classes; it is not a column
      const { weekCount: _weekCount, ...single } = data;
      void _weekCount;
      result = await createClassSession({
        ...single,
        startTime,
        endTime,
      });
    }

    // Students registered for the term get the new dates too
    await syncRegistrationsForTemplate(data.templateId);

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/sessions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
