/**
 * Teacher pay report: the sums, kept free of database code. Teachers are
 * contractors paid outside the app; the report says what they taught so the
 * studio knows what to pay.
 */

export interface TaughtClass {
  sessionId: string;
  className: string;
  roomName: string;
  startTime: string;
  endTime: string;
  minutes: number;
  /** Students booked into the class */
  enrolled: number;
  /** Students marked present or late; null until attendance is submitted */
  attended: number | null;
  /** The regular teacher, when this teacher taught the class as a substitute */
  coveringFor: string | null;
}

/** One of this teacher's own classes that a substitute taught instead (not paid to them). */
export interface CoveredClass {
  sessionId: string;
  className: string;
  startTime: string;
  endTime: string;
  minutes: number;
  substituteName: string;
  reason: string | null;
}

export interface TeacherReportTotals {
  classes: number;
  minutes: number;
  /** Hours taught, to two decimals */
  hours: number;
  /** Classes whose attendance has not been submitted */
  attendanceMissing: number;
  /** How many of the classes were taught as a substitute for someone else */
  asSubstitute: number;
  byClass: { className: string; classes: number; minutes: number }[];
}

export function summarizeTaught(classes: TaughtClass[]): TeacherReportTotals {
  const groups = new Map<string, { className: string; classes: number; minutes: number }>();
  let minutes = 0;
  for (const taught of classes) {
    minutes += taught.minutes;
    const group = groups.get(taught.className) ?? { className: taught.className, classes: 0, minutes: 0 };
    group.classes += 1;
    group.minutes += taught.minutes;
    groups.set(taught.className, group);
  }
  return {
    classes: classes.length,
    minutes,
    hours: Math.round((minutes / 60) * 100) / 100,
    attendanceMissing: classes.filter((taught) => taught.attended === null).length,
    asSubstitute: classes.filter((taught) => taught.coveringFor !== null).length,
    byClass: Array.from(groups.values()).sort((a, b) => a.className.localeCompare(b.className)),
  };
}

export type PayBasis = "PER_CLASS" | "PER_HOUR";

/** What the teacher is owed at a rate (in cents) per class or per hour, in cents. */
export function payOwedCents(
  totals: Pick<TeacherReportTotals, "classes" | "minutes">,
  basis: PayBasis,
  rateCents: number
): number {
  if (!Number.isFinite(rateCents) || rateCents <= 0) return 0;
  return basis === "PER_CLASS"
    ? totals.classes * rateCents
    : Math.round((totals.minutes * rateCents) / 60);
}
