import { getPublicSchedule, getPublicStudio, type PublicSession } from "@/lib/db/public";
import { getOwnAttendance } from "@/lib/db/student-attendance";
import { prisma } from "@/lib/prisma";

export interface PortalMakeupCredit {
  /** The missed class's attendance record, which a makeup booking points at */
  attendanceId: string;
  className: string;
  startTime: string;
}

export interface PortalDancer {
  id: string;
  firstName: string;
  lastName: string;
  /** Missed classes that can still be made up */
  makeups: PortalMakeupCredit[];
}

export interface PortalBrowseSession extends PublicSession {
  /** This account's dancers who already hold a place or a waitlist spot in the class */
  booked: { studentId: string; status: "ACTIVE" | "WAITLIST"; makeup: boolean }[];
}

export interface PortalClassBrowser {
  timeZone: string;
  students: PortalDancer[];
  sessions: PortalBrowseSession[];
}

/**
 * Every upcoming class at the studio, for a parent or adult student to browse:
 * which of their own dancers are already in each one, and the missed classes
 * each dancer could use as a makeup. Other families' bookings are only ever
 * counted (spots left), never listed.
 */
export async function getPortalClassBrowser(userId: string): Promise<PortalClassBrowser> {
  const [studio, sessions, attendance, bookings] = await Promise.all([
    getPublicStudio(),
    getPublicSchedule(),
    getOwnAttendance(userId),
    prisma.enrollment.findMany({
      where: {
        student: { OR: [{ guardian: { userId } }, { userId }] },
        status: { in: ["ACTIVE", "WAITLIST"] },
        session: { startTime: { gte: new Date() } },
      },
      select: { studentId: true, sessionId: true, status: true, makeupForId: true },
    }),
  ]);

  // Group in memory rather than querying once per class
  const bySession = new Map<string, PortalBrowseSession["booked"]>();
  for (const booking of bookings) {
    const list = bySession.get(booking.sessionId) ?? [];
    list.push({
      studentId: booking.studentId,
      status: booking.status === "WAITLIST" ? "WAITLIST" : "ACTIVE",
      makeup: booking.makeupForId !== null,
    });
    bySession.set(booking.sessionId, list);
  }

  return {
    timeZone: studio.timezone,
    students: attendance.map(({ student, records }) => ({
      ...student,
      makeups: records
        .filter((record) => record.makeupState === "AVAILABLE")
        .map((record) => ({
          attendanceId: record.id,
          className: record.class.className,
          startTime: record.class.startTime,
        })),
    })),
    sessions: sessions.map((session) => ({ ...session, booked: bySession.get(session.id) ?? [] })),
  };
}
