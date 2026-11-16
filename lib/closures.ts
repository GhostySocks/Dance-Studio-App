/**
 * Studio closures (holidays, breaks): the day arithmetic, kept free of database
 * code. A closure covers whole studio calendar days, stored as "YYYY-MM-DD"
 * strings so they mean the same day whatever timezone they are read in.
 */

export interface ClosureDays {
  name: string;
  /** First closed day, "YYYY-MM-DD" */
  startDay: string;
  /** Last closed day (inclusive), "YYYY-MM-DD" */
  endDay: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtc(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year, month - 1, date);
}

/** The day after `day` (or `count` days after), as "YYYY-MM-DD". */
export function addDays(day: string, count = 1): string {
  return new Date(toUtc(day) + count * DAY_MS).toISOString().slice(0, 10);
}

/** How many days a closure covers, counting both ends. */
export function closureLength(closure: Pick<ClosureDays, "startDay" | "endDay">): number {
  return Math.round((toUtc(closure.endDay) - toUtc(closure.startDay)) / DAY_MS) + 1;
}

/**
 * Every closed day mapped to the closure's name. Where closures overlap, the one
 * that starts first names the day.
 */
export function closedDays(closures: ClosureDays[]): Map<string, string> {
  const days = new Map<string, string>();
  const ordered = [...closures].sort((a, b) => a.startDay.localeCompare(b.startDay));
  for (const closure of ordered) {
    // Guard against a bad record (end before start) looping for ever
    const length = Math.min(Math.max(closureLength(closure), 0), 366);
    for (let i = 0; i < length; i++) {
      const day = addDays(closure.startDay, i);
      if (!days.has(day)) days.set(day, closure.name);
    }
  }
  return days;
}

/** "Dec 24" or "Dec 24 – Jan 1, 2027": the closure's days for display. */
export function closureRangeLabel(closure: Pick<ClosureDays, "startDay" | "endDay">): string {
  const format = (day: string, withYear: boolean) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: withYear ? "numeric" : undefined,
      timeZone: "UTC",
    }).format(new Date(toUtc(day)));
  if (closure.startDay === closure.endDay) return format(closure.startDay, true);
  return `${format(closure.startDay, false)} – ${format(closure.endDay, true)}`;
}
