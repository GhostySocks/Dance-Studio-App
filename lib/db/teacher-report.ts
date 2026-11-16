import { closedDays } from "@/lib/closures";
import { getClosures } from "@/lib/db/closures";
import { prisma } from "@/lib/prisma";
import {
  summarizeTaught,
  type CoveredClass,
  type TaughtClass,
  type TeacherReportTotals,
} from "@/lib/teacher-report";
import { dayIn, endOfDayIn, startOfDayIn } from "@/lib/timezone";

export interface TeacherReport {
  teacher: { id: string; name: string };
  /** The studio calendar days covered, both included */
  startDay: string;
  endDay: string;
  timeZone: string;
  studioName: string;
  classes: TaughtClass[];
  totals: TeacherReportTotals;
  /** This teacher's own classes that a substitute taught in the period (not counted above) */
  covered: CoveredClass[];
}

/** The teacher profile belonging to a signed-in teacher, if any. */
export async function getTeacherIdForUser(userId: string): Promise<string | null> {
  const teacher = await prisma.teacher.findUnique({ where: { userId }, select: { id: true } });
  return teacher?.id ?? null;
}

/**
 * The classes a teacher taught between two studio calendar days (both included).
 * Only classes that have already started count, and classes on days the studio
 * was closed are left out. A class taught by a substitute counts for the
 * substitute; the regular teacher's report lists it separately. Returns null if
 * the teacher does not exist.
 */
export async function getTeacherReport({
  teacherId,
  startDay,
  endDay,
  timeZone,
  studioName = "Dance Studio",
}: {
  teacherId: string;
  startDay: string;
  endDay: string;
  timeZone: string;
  studioName?: string;
}): Promise<TeacherReport | null> {
  const now = new Date();
  const periodEnd = endOfDayIn(timeZone, endDay);
  const period = { gte: startOfDayIn(timeZone, startDay), lte: periodEnd < now ? periodEnd : now };
  const [teacher, sessions, closures, coveredSessions] = await Promise.all([
    prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true, user: { select: { name: true } } },
    }),
    prisma.classSession.findMany({
      where: {
        teacherId,
        startTime: period,
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        template: { select: { name: true } },
        room: { select: { name: true } },
        substituteFor: { select: { user: { select: { name: true } } } },
        _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
        attendance: { where: { lockedAt: { not: null } }, select: { status: true } },
      },
      orderBy: { startTime: "asc" },
    }),
    getClosures({ from: startDay, to: endDay }),
    prisma.classSession.findMany({
      where: { substituteForId: teacherId, startTime: period },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        substituteReason: true,
        template: { select: { name: true } },
        teacher: { select: { user: { select: { name: true } } } },
      },
      orderBy: { startTime: "asc" },
    }),
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
      coveringFor: session.substituteFor ? (session.substituteFor.user.name ?? "another teacher") : null,
    }));

  const covered: CoveredClass[] = coveredSessions
    .filter((session) => !closed.has(dayIn(timeZone, session.startTime)))
    .map((session) => ({
      sessionId: session.id,
      className: session.template.name,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime.toISOString(),
      minutes: Math.round((session.endTime.getTime() - session.startTime.getTime()) / 60000),
      substituteName: session.teacher.user.name ?? "A substitute",
      reason: session.substituteReason,
    }));

  return {
    teacher: { id: teacher.id, name: teacher.user.name ?? "Teacher" },
    startDay,
    endDay,
    timeZone,
    studioName,
    classes,
    totals: summarizeTaught(classes),
    covered,
  };
}
