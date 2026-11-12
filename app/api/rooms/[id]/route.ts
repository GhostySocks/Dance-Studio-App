import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/api-auth";
import { getRoomById, updateRoom, deleteRoom } from "@/lib/db/rooms";
import { roomSchema } from "@/lib/validations/room";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const room = await getRoomById(params.id);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    return NextResponse.json({ data: room });
  } catch (error) {
    console.error("GET /api/rooms/[id] error:", error);
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
    const parsed = roomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const data = parsed.data;
    const room = await updateRoom(params.id, {
      name: data.name,
      description: data.description || null,
      capacity: data.capacity,
    });

    return NextResponse.json({ data: room });
  } catch (error) {
    console.error("PUT /api/rooms/[id] error:", error);
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

    await deleteRoom(params.id);
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error("DELETE /api/rooms/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
