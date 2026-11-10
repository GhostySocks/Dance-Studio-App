import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Reads the session cookie, so it can never be prerendered
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "revenue";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate) : new Date();

    switch (type) {
      case "revenue": {
        const invoices = await prisma.invoice.findMany({
          where: {
            status: "PAID",
            createdAt: { gte: start, lte: end },
          },
          include: {
            student: { select: { firstName: true, lastName: true } },
            familyGroup: { select: { name: true } },
            lineItems: true,
          },
          orderBy: { createdAt: "desc" },
        });

        const totalRevenue = invoices.reduce((s, i) => s + i.totalCents, 0);
        const totalTuition = invoices.reduce(
          (s, i) => s + i.lineItems.filter((l) => l.type === "TUITION").reduce((ls, l) => ls + l.amountCents, 0),
          0
        );
        const totalDiscounts = invoices.reduce(
          (s, i) => s + i.lineItems.filter((l) => l.type === "DISCOUNT").reduce((ls, l) => ls + Math.abs(l.amountCents), 0),
          0
        );
        const totalScholarships = invoices.reduce(
          (s, i) => s + i.lineItems.filter((l) => l.type === "SCHOLARSHIP").reduce((ls, l) => ls + Math.abs(l.amountCents), 0),
          0
        );

        return NextResponse.json({
          data: {
            type: "revenue",
            invoices,
            summary: { totalRevenue, totalTuition, totalDiscounts, totalScholarships, invoiceCount: invoices.length },
          },
        });
      }

      case "enrollment": {
        const enrollments = await prisma.enrollment.findMany({
          where: { createdAt: { gte: start, lte: end } },
          include: {
            student: { select: { firstName: true, lastName: true } },
            session: {
              include: {
                template: { select: { name: true, danceStyle: true, basePriceCents: true } },
                teacher: { select: { user: { select: { name: true } } } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        const active = enrollments.filter((e) => e.status === "ACTIVE").length;
        const waitlist = enrollments.filter((e) => e.status === "WAITLIST").length;
        const cancelled = enrollments.filter((e) => e.status === "CANCELLED").length;

        return NextResponse.json({
          data: {
            type: "enrollment",
            enrollments,
            summary: { total: enrollments.length, active, waitlist, cancelled },
          },
        });
      }

      case "utilization": {
        const rooms = await prisma.room.findMany({
          include: {
            sessions: {
              where: { startTime: { gte: start, lte: end } },
              select: {
                id: true,
                startTime: true,
                endTime: true,
                maxCapacity: true,
                enrollments: { where: { status: "ACTIVE" }, select: { id: true } },
              },
            },
          },
        });

        const roomStats = rooms.map((room) => {
          const totalSessions = room.sessions.length;
          const totalHours = room.sessions.reduce((s, sess) => {
            const dur = (new Date(sess.endTime).getTime() - new Date(sess.startTime).getTime()) / 3600000;
            return s + dur;
          }, 0);
          const avgOccupancy = totalSessions > 0
            ? Math.round(
                room.sessions.reduce((s, sess) => s + (sess.enrollments.length / sess.maxCapacity) * 100, 0) / totalSessions
              )
            : 0;

          return {
            id: room.id,
            name: room.name,
            capacity: room.capacity,
            totalSessions,
            totalHours: Math.round(totalHours * 10) / 10,
            avgOccupancy,
          };
        });

        return NextResponse.json({
          data: { type: "utilization", rooms: roomStats },
        });
      }

      default:
        return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
    }
  } catch (error) {
    console.error("GET /api/admin/reports error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
