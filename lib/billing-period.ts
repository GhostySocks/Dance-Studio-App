import { endOfDayIn, startOfDayIn } from "@/lib/timezone";

/**
 * A billing period chosen as two calendar days ("YYYY-MM-DD") covers both days in
 * full in the studio's timezone: from the first instant of the start day to the
 * last second of the end day. Without this a class on the last day is left off.
 */
export function billingPeriod(timeZone: string, startDay: string, endDay: string) {
  return {
    periodStart: startOfDayIn(timeZone, startDay.slice(0, 10)),
    periodEnd: endOfDayIn(timeZone, endDay.slice(0, 10)),
  };
}

/** Runs `task` over `items`, at most `limit` at a time, keeping the results in order. */
export async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
