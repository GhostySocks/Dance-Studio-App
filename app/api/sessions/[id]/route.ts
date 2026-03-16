import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getClassSessionById, updateClassSession, deleteClassSession } from "@/lib/db/classes";
import { checkRoomConflict } from "@/lib/db/rooms";
import { classSessionSchema } from "@/lib/validations/class";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const classSession = await getClassSessionById(params.id);
    if (!classSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ data: classSession });
  } catch (error) {
    console.error("GET /api/sessions/[id] error:", error);
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
    const parsed = classSessionSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const data = parsed.data;

    // Check room conflict if room or time is being updated
    if (data.roomId || data.startTime || data.endTime) {
      const existing = await getClassSessionById(params.id);
      if (!existing) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      const roomId = data.roomId ?? existing.roomId;
      const startTime = data.startTime ? new Date(data.startTime) : existing.startTime;
      const endTime = data.endTime ? new Date(data.endTime) : existing.endTime;

      const conflict = await checkRoomConflict(roomId, startTime, endTime, params.id);
      if (conflict) {
        return NextResponse.json(
          { error: "Room is already booked for this time" },
          { status: 409 }
        );
      }
    }

    const updateData = {
      ...data,
      startTime: data.startTime ? new Date(data.startTime) : undefined,
      endTime: data.endTime ? new Date(data.endTime) : undefined,
    };

    const classSession = await updateClassSession(params.id, updateData);

    return NextResponse.json({ data: classSession });
  } catch (error) {
    console.error("PUT /api/sessions/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteClassSession(params.id);
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error("DELETE /api/sessions/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
