import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/api-auth";
import { getRooms, createRoom } from "@/lib/db/rooms";
import { roomSchema } from "@/lib/validations/room";

export async function GET(req: NextRequest) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? undefined;
    const page = parseInt(searchParams.get("page") ?? "1");
    const perPage = parseInt(searchParams.get("perPage") ?? "10");

    const result = await getRooms({ search, page, perPage });
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("GET /api/rooms error:", error);
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
    const parsed = roomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const data = parsed.data;
    const room = await createRoom({
      name: data.name,
      description: data.description || null,
      capacity: data.capacity,
    });

    return NextResponse.json({ data: room }, { status: 201 });
  } catch (error) {
    console.error("POST /api/rooms error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
