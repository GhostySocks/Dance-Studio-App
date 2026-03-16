import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [
      totalStudents,
      totalFamilies,
      totalTeachers,
      activeEnrollments,
      waitlistCount,
      totalRooms,
      upcomingSessions,
      invoiceStats,
      revenueThisMonth,
      recentEnrollments,
    ] = await Promise.all([
      prisma.student.count(),
      prisma.familyGroup.count(),
      prisma.teacher.count(),
      prisma.enrollment.count({ where: { status: "ACTIVE" } }),
      prisma.enrollment.count({ where: { status: "WAITLIST" } }),
      prisma.room.count(),
      prisma.classSession.count({
        where: { startTime: { gte: now } },
      }),
      prisma.invoice.groupBy({
        by: ["status"],
        _count: true,
        _sum: { totalCents: true },
      }),
      prisma.invoice.aggregate({
        where: {
          status: "PAID",
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { totalCents: true },
      }),
      prisma.enrollment.findMany({
        where: { createdAt: { gte: startOfMonth } },
        include: {
          student: { select: { firstName: true, lastName: true } },
          session: {
            include: {
              template: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    // Chart queries use raw SQL — wrap each in try/catch so a failure doesn't crash the whole dashboard
    let monthlyRevenueData: { month: string; total: number }[] = [];
    let enrollmentsByStyleData: { style: string; count: number }[] = [];
    let roomUtilizationData: { name: string; sessions: number; capacity: number }[] = [];

    try {
      const raw = await prisma.$queryRawUnsafe<{ month: string; total: bigint | number }[]>(`
        SELECT
          TO_CHAR("createdAt", 'YYYY-MM') as month,
          COALESCE(SUM("totalCents"), 0) as total
        FROM "Invoice"
        WHERE status = 'PAID'
          AND "createdAt" >= NOW() - INTERVAL '6 months'
        GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
        ORDER BY month ASC
      `);
      monthlyRevenueData = raw.map((r) => ({ month: r.month, total: Number(r.total) }));
    } catch (e) {
      console.error("Monthly revenue chart query failed:", e);
    }

    try {
      const raw = await prisma.$queryRawUnsafe<{ style: string; count: bigint | number }[]>(`
        SELECT
          COALESCE(ct."danceStyle", 'Other') as style,
          COUNT(e.id) as count
        FROM "Enrollment" e
        JOIN "ClassSession" cs ON e."sessionId" = cs.id
        JOIN "ClassTemplate" ct ON cs."templateId" = ct.id
        WHERE e.status = 'ACTIVE'
        GROUP BY ct."danceStyle"
        ORDER BY count DESC
      `);
      enrollmentsByStyleData = raw.map((r) => ({ style: r.style, count: Number(r.count) }));
    } catch (e) {
      console.error("Enrollments by style chart query failed:", e);
    }

    try {
      const raw = await prisma.$queryRawUnsafe<{ name: string; sessions: bigint | number; capacity: number }[]>(`
        SELECT
          r.name,
          COUNT(cs.id) as sessions,
          r.capacity
        FROM "Room" r
        LEFT JOIN "ClassSession" cs ON cs."roomId" = r.id
          AND cs."startTime" >= $1
          AND cs."startTime" <= $2
        GROUP BY r.id, r.name, r.capacity
        ORDER BY sessions DESC
      `, startOfMonth.toISOString(), endOfMonth.toISOString());
      roomUtilizationData = raw.map((r) => ({ name: r.name, sessions: Number(r.sessions), capacity: Number(r.capacity) }));
    } catch (e) {
      console.error("Room utilization chart query failed:", e);
    }

    const invoiceSummary: Record<string, { count: number; totalCents: number }> = {};
    for (const row of invoiceStats) {
      invoiceSummary[row.status] = {
        count: row._count,
        totalCents: Number(row._sum.totalCents ?? 0),
      };
    }

    return NextResponse.json({
      data: {
        overview: {
          totalStudents,
          totalFamilies,
          totalTeachers,
          activeEnrollments,
          waitlistCount,
          totalRooms,
          upcomingSessions,
          revenueThisMonth: Number(revenueThisMonth._sum.totalCents ?? 0),
        },
        invoiceSummary,
        recentEnrollments,
        charts: {
          monthlyRevenue: monthlyRevenueData,
          enrollmentsByStyle: enrollmentsByStyleData,
          roomUtilization: roomUtilizationData,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/admin/stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
