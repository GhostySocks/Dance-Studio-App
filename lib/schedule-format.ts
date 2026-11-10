/** Date helpers for the public schedule. Everything is shown in the studio's timezone. */

export function formatTimeRange(start: string, end: string, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone });
  return `${fmt.format(new Date(start))} – ${fmt.format(new Date(end))}`;
}

export function formatDayHeading(date: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(new Date(date));
}

export function formatShortDay(date: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone,
  }).format(new Date(date));
}

/** Stable "YYYY-MM-DD" key for the studio-local calendar day. */
export function dayKey(date: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(new Date(date));
}

export function groupByDay<T extends { startTime: string }>(
  sessions: T[],
  timeZone: string
): { key: string; heading: string; sessions: T[] }[] {
  const groups = new Map<string, { key: string; heading: string; sessions: T[] }>();
  for (const session of sessions) {
    const key = dayKey(session.startTime, timeZone);
    const group = groups.get(key) ?? {
      key,
      heading: formatDayHeading(session.startTime, timeZone),
      sessions: [],
    };
    group.sessions.push(session);
    groups.set(key, group);
  }
  return Array.from(groups.values());
}

export function spotsLabel(spotsLeft: number): string {
  if (spotsLeft <= 0) return "Waitlist only";
  if (spotsLeft === 1) return "1 spot left";
  return `${spotsLeft} spots left`;
}
