/**
 * Makeup classes: the rules, kept free of database code so they are easy to test.
 *
 * A student who misses a class (marked absent or excused once the teacher has
 * submitted attendance) may attend one other class in its place. The makeup is an
 * ordinary enrollment that points at the missed attendance record
 * (`Enrollment.makeupForId`), is never billed, and only ever takes a free spot.
 */

export type AttendanceMark = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

/** What a missed class means for makeups. */
export type MakeupState =
  /** Attended, or attendance has not been submitted: nothing to make up */
  | "NONE"
  /** Missed, no makeup booked yet */
  | "AVAILABLE"
  /** A makeup class is booked and has not happened yet */
  | "BOOKED"
  /** The makeup class has taken place (or its time has passed) */
  | "USED"
  /** The missed class was itself a makeup; a makeup cannot be made up again */
  | "NOT_ELIGIBLE";

export const MISSED: readonly AttendanceMark[] = ["ABSENT", "EXCUSED"];

export function isMissed(status: AttendanceMark): boolean {
  return MISSED.includes(status);
}

export function makeupState(
  record: {
    status: AttendanceMark;
    /** Attendance only counts once the teacher has submitted it */
    submitted: boolean;
    /** The class that was missed was itself a makeup */
    wasMakeup: boolean;
    /** The makeup booked for this absence, if any (cancelled ones do not count) */
    makeup: { startTime: Date | string } | null;
  },
  now: Date = new Date()
): MakeupState {
  if (!record.submitted || !isMissed(record.status)) return "NONE";
  if (record.makeup) {
    return new Date(record.makeup.startTime).getTime() > now.getTime() ? "BOOKED" : "USED";
  }
  return record.wasMakeup ? "NOT_ELIGIBLE" : "AVAILABLE";
}

export interface AttendanceSummary {
  present: number;
  late: number;
  absent: number;
  excused: number;
  /** Classes with submitted attendance */
  total: number;
  /** Share of classes attended (present or late), 0 to 100, or null with no classes */
  attendedPercent: number | null;
  /** Missed classes that can still be made up */
  makeupsAvailable: number;
}

export function summarizeAttendance(
  records: { status: AttendanceMark; makeupState: MakeupState }[]
): AttendanceSummary {
  const count = (status: AttendanceMark) => records.filter((r) => r.status === status).length;
  const present = count("PRESENT");
  const late = count("LATE");
  const total = records.length;
  return {
    present,
    late,
    absent: count("ABSENT"),
    excused: count("EXCUSED"),
    total,
    attendedPercent: total === 0 ? null : Math.round(((present + late) / total) * 100),
    makeupsAvailable: records.filter((r) => r.makeupState === "AVAILABLE").length,
  };
}
