/**
 * Month-grid maths for the public schedule calendar. Works on plain "YYYY-MM-DD"
 * and "YYYY-MM" strings (already in the studio's timezone), so there is no
 * timezone arithmetic here and nothing depends on the viewer's clock.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-11-16" -> "2026-11" */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

/** Every month from `first` to `last` inclusive, e.g. ["2026-11", "2026-12", "2027-01"]. */
export function monthsBetween(first: string, last: string): string[] {
  const out: string[] = [];
  let [year, month] = first.split("-").map(Number);
  const [lastYear, lastMonth] = last.split("-").map(Number);
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    out.push(`${year}-${pad(month)}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

/** "2026-11" -> "November 2026" */
export function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, m - 1, 1))
  );
}

/** "2026-11-16" -> "Monday, November 16" */
export function dayLabel(day: string): string {
  const [year, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, m - 1, d)));
}

export interface GridDay {
  /** "YYYY-MM-DD" */
  key: string;
  dayOfMonth: number;
  /** False for the leading/trailing days that belong to the neighbouring months. */
  inMonth: boolean;
}

/**
 * The weeks of a month as rows of seven days, Sunday first, padded with the
 * neighbouring months' days so every row is full.
 */
export function monthGrid(month: string): GridDay[][] {
  const [year, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, m - 1, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());

  const weeks: GridDay[][] = [];
  const cursor = new Date(start);
  do {
    const week: GridDay[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({
        key: cursor.toISOString().slice(0, 10),
        dayOfMonth: cursor.getUTCDate(),
        inMonth: cursor.getUTCMonth() === m - 1,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  } while (cursor.getUTCMonth() === m - 1);
  return weeks;
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
