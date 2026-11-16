import { closedDays } from "@/lib/closures";
import { getClosures } from "@/lib/db/closures";
import { prisma } from "@/lib/prisma";
import { summarizeTaught, type TaughtClass, type TeacherReportTotals } from "@/lib/teacher-report";
import { dayIn, endOfDayIn, startOfDayIn } from "@/lib/timezone";

export interface TeacherReport {
  teacher: { id: string; name: string };
  /** The studio calendar days covered, both included */
  startDay: string;
  endDay: string;
  timeZone: string;
  classes: TaughtClass[];
  totals: TeacherReportTotals;
}

/** The teacher profile belonging to a signed-in teacher, if any. */
export async function getTeacherIdForUser(userId: string): Promise<string | null> {
  const teacher = await prisma.teacher.findUnique({ where: { userId }, select: { id: true } });
  return teacher?.id ?? null;
}

/**
 * The classes a teacher taught between two studio calendar days (both included).
 * Only classes that have already started count, and classes on days the studio
 * was closed are left out. Returns null if the teacher does not exist.
 */
export async function getTeacherReport({
  teacherId,
  startDay,
  endDay,
  timeZone,
}: {
  teacherId: string;
  startDay: string;
  endDay: string;
  timeZone: string;
}): Promise<TeacherReport | null> {
  const now = new Date();
  const periodEnd = endOfDayIn(timeZone, endDay);
  const [teacher, sessions, closures] = await Promise.all([
    prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true, user: { select: { name: true } } },
    }),
    prisma.classSession.findMany({
      where: {
        teacherId,
        startTime: {
          gte: startOfDayIn(timeZone, startDay),
          lte: periodEnd < now ? periodEnd : now,
        },
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        template: { select: { name: true } },
        room: { select: { name: true } },
        _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
        attendance: { where: { lockedAt: { not: null } }, select: { status: true } },
      },
      orderBy: { startTime: "asc" },
    }),
    getClosures({ from: startDay, to: endDay }),
  ]);
  if (!teacher) return null;

  const closed = closedDays(closures);
  const classes: TaughtClass[] = sessions
    .filter((session) => !closed.has(dayIn(timeZone, session.startTime)))
    .map((session) => ({
      sessionId: session.id,
      className: session.template.name,
      roomName: session.room.name,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime.toISOString(),
      minutes: Math.round((session.endTime.getTime() - session.startTime.getTime()) / 60000),
      enrolled: session._count.enrollments,
      attended:
        session.attendance.length === 0
          ? null
          : session.attendance.filter((a) => a.status === "PRESENT" || a.status === "LATE").length,
    }));

  return {
    teacher: { id: teacher.id, name: teacher.user.name ?? "Teacher" },
    startDay,
    endDay,
    timeZone,
    classes,
    totals: summarizeTaught(classes),
  };
}
