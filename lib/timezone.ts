/** Timezone helpers with no dependencies, shared by the app and the prisma scripts. */

/** Minutes that `timeZone` is ahead of UTC at the given instant (negative for the Americas). */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** The UTC instant for a wall-clock time in `timeZone`. `month` is 0-based. */
export function zonedTime(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0
): Date {
  const guess = new Date(Date.UTC(year, month, day, hour, minute, second));
  return new Date(guess.getTime() - tzOffsetMinutes(guess, timeZone) * 60000);
}

/** First instant of a "YYYY-MM-DD" calendar day in `timeZone`. */
export function startOfDayIn(timeZone: string, day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return zonedTime(timeZone, y, m - 1, d, 0, 0, 0);
}

/** Last second of a "YYYY-MM-DD" calendar day in `timeZone`. */
export function endOfDayIn(timeZone: string, day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return zonedTime(timeZone, y, m - 1, d, 23, 59, 59);
}

/** The "YYYY-MM-DD" calendar day of an instant in `timeZone`. */
export function dayIn(timeZone: string, date: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}
