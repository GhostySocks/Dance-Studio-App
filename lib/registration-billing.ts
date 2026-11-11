/**
 * How a term registration turns into charges. Pure functions, no database:
 * safe to import from client components and easy to test.
 */

export type BillingPlan = "PER_CLASS" | "WEEKLY" | "MONTHLY" | "SEMESTER" | "ANNUAL";

/** Plans that register a student for every date in a term (or season). */
export const TERM_PLANS = ["WEEKLY", "MONTHLY", "SEMESTER", "ANNUAL"] as const;
export type TermPlan = (typeof TERM_PLANS)[number];

export const PLAN_LABELS: Record<BillingPlan, string> = {
  PER_CLASS: "Per class",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  SEMESTER: "Semester",
  ANNUAL: "Annual",
};

/** "$22.00 per week" */
export const PLAN_UNITS: Record<BillingPlan, string> = {
  PER_CLASS: "per class",
  WEEKLY: "per week",
  MONTHLY: "per month",
  SEMESTER: "for the semester",
  ANNUAL: "for the year",
};

export const PLAN_HINTS: Record<TermPlan, string> = {
  WEEKLY: "Billed for each week that has a class.",
  MONTHLY: "Billed for each month that has a class.",
  SEMESTER: "One payment covers every class in the term.",
  ANNUAL: "One payment covers every class in the season.",
};

export function isTermPlan(plan: string): plan is TermPlan {
  return (TERM_PLANS as readonly string[]).includes(plan);
}

export interface PlanCharge {
  /** Stable id of the instalment: "full", a month "2026-11", or a week's Monday "2026-11-09". */
  key: string;
  /** Shown on the invoice line, e.g. "November 2026" or "week of Nov 9". */
  label: string;
  /** The charge may be invoiced from this moment on. */
  dueDate: Date;
  amountCents: number;
}

function localDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Monday ("YYYY-MM-DD") of the studio-local week containing `date`. */
export function weekKey(date: Date, timeZone: string): string {
  const [y, m, d] = localDay(date, timeZone).split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  const sinceMonday = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - sinceMonday);
  return day.toISOString().slice(0, 10);
}

/** "YYYY-MM" of the studio-local month containing `date`. */
export function monthKey(date: Date, timeZone: string): string {
  return localDay(date, timeZone).slice(0, 7);
}

function weekLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const label = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
  return `week of ${label}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/**
 * Every charge a registration gives rise to, oldest first.
 *
 * - SEMESTER / ANNUAL: one charge, owed from the moment of registration.
 * - MONTHLY / WEEKLY: one charge per month / week in which the student has at
 *   least one class, owed from the first class in it. A week or month with no
 *   class (a holiday, or dates the student is only waitlisted for) is not charged.
 *
 * `sessionStarts` are the start times of the dates the student actually holds a
 * spot in. With none, nothing is owed.
 */
export function planCharges({
  plan,
  priceCents,
  coverageName,
  registeredAt,
  sessionStarts,
  timeZone,
}: {
  plan: BillingPlan;
  priceCents: number;
  /** Term or season name, used as the label of a one-off charge. */
  coverageName: string;
  registeredAt: Date;
  sessionStarts: Date[];
  timeZone: string;
}): PlanCharge[] {
  if (sessionStarts.length === 0 || plan === "PER_CLASS") return [];

  if (plan === "SEMESTER" || plan === "ANNUAL") {
    return [{ key: "full", label: coverageName, dueDate: registeredAt, amountCents: priceCents }];
  }

  const keyOf = plan === "WEEKLY" ? weekKey : monthKey;
  const labelOf = plan === "WEEKLY" ? weekLabel : monthLabel;

  const firstInBucket = new Map<string, Date>();
  for (const start of sessionStarts) {
    const key = keyOf(start, timeZone);
    const current = firstInBucket.get(key);
    if (!current || start < current) firstInBucket.set(key, start);
  }

  return Array.from(firstInBucket.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, dueDate]) => ({ key, label: labelOf(key), dueDate, amountCents: priceCents }));
}

/** The charges to put on an invoice for a period: owed by its end and not billed before. */
export function chargesToBill(charges: PlanCharge[], periodEnd: Date, billedKeys: Iterable<string>) {
  const billed = new Set(billedKeys);
  return charges.filter((c) => c.dueDate <= periodEnd && !billed.has(c.key));
}
