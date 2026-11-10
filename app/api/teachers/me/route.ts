import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Reads the session cookie, so it can never be prerendered
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { userId: session.user.id },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        sessions: {
          where: {
            startTime: { gte: new Date() },
          },
          include: {
            template: { select: { name: true, danceStyle: true } },
            room: { select: { name: true } },
            enrollments: { select: { id: true } },
          },
          orderBy: { startTime: "asc" },
        },
      },
    });

    if (!teacher) {
      return NextResponse.json(
        { error: "Teacher profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: teacher });
  } catch (error) {
    console.error("GET /api/teachers/me error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
