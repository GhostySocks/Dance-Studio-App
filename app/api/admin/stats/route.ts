import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Reads the session cookie, so it can never be prerendered
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Everything below runs at once. The seven headline counts share one query,
    // because each separate query is its own round trip to the database.
    const countsQuery = prisma.$queryRaw<
      {
        students: bigint;
        families: bigint;
        teachers: bigint;
        active: bigint;
        waitlist: bigint;
        rooms: bigint;
        upcoming: bigint;
      }[]
    >`
      SELECT
        (SELECT COUNT(*) FROM "Student") AS students,
        (SELECT COUNT(*) FROM "FamilyGroup") AS families,
        (SELECT COUNT(*) FROM "Teacher") AS teachers,
        (SELECT COUNT(*) FROM "Enrollment" WHERE status = 'ACTIVE') AS active,
        (SELECT COUNT(*) FROM "Enrollment" WHERE status = 'WAITLIST') AS waitlist,
        (SELECT COUNT(*) FROM "Room") AS rooms,
        (SELECT COUNT(*) FROM "ClassSession" WHERE "startTime" >= ${now}) AS upcoming
    `;

    const [
      [counts],
      invoiceStats,
      revenueThisMonth,
      recentEnrollments,
      monthlyRevenueData,
      enrollmentsByStyleData,
      roomUtilizationData,
    ] = await Promise.all([
      countsQuery,
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
      // Chart queries: a failure in one must not take down the whole dashboard
      prisma
        .$queryRaw<{ month: string; total: bigint | number }[]>`
          SELECT
            TO_CHAR("createdAt", 'YYYY-MM') as month,
            COALESCE(SUM("totalCents"), 0) as total
          FROM "Invoice"
          WHERE status = 'PAID'
            AND "createdAt" >= NOW() - INTERVAL '6 months'
          GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
          ORDER BY month ASC
        `
        .then((rows) => rows.map((r) => ({ month: r.month, total: Number(r.total) })))
        .catch((e) => {
          console.error("Monthly revenue chart query failed:", e);
          return [] as { month: string; total: number }[];
        }),
      prisma
        .$queryRaw<{ style: string; count: bigint | number }[]>`
          SELECT
            COALESCE(ct."danceStyle", 'Other') as style,
            COUNT(e.id) as count
          FROM "Enrollment" e
          JOIN "ClassSession" cs ON e."sessionId" = cs.id
          JOIN "ClassTemplate" ct ON cs."templateId" = ct.id
          WHERE e.status = 'ACTIVE'
          GROUP BY ct."danceStyle"
          ORDER BY count DESC
        `
        .then((rows) => rows.map((r) => ({ style: r.style, count: Number(r.count) })))
        .catch((e) => {
          console.error("Enrollments by style chart query failed:", e);
          return [] as { style: string; count: number }[];
        }),
      prisma
        .$queryRaw<{ name: string; sessions: bigint | number; capacity: number }[]>`
          SELECT
            r.name,
            COUNT(cs.id) as sessions,
            r.capacity
          FROM "Room" r
          LEFT JOIN "ClassSession" cs ON cs."roomId" = r.id
            AND cs."startTime" >= ${startOfMonth}
            AND cs."startTime" <= ${endOfMonth}
          GROUP BY r.id, r.name, r.capacity
          ORDER BY sessions DESC
        `
        .then((rows) =>
          rows.map((r) => ({ name: r.name, sessions: Number(r.sessions), capacity: Number(r.capacity) }))
        )
        .catch((e) => {
          console.error("Room utilization chart query failed:", e);
          return [] as { name: string; sessions: number; capacity: number }[];
        }),
    ]);

    const totalStudents = Number(counts.students);
    const totalFamilies = Number(counts.families);
    const totalTeachers = Number(counts.teachers);
    const activeEnrollments = Number(counts.active);
    const waitlistCount = Number(counts.waitlist);
    const totalRooms = Number(counts.rooms);
    const upcomingSessions = Number(counts.upcoming);


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
