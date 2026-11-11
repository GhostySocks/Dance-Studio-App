import { claimBillingRun, recordBillingRun } from "@/lib/db/system";
import { runBillingJobs } from "@/lib/payment-service";

const CHECK_EVERY_MS = 10 * 60 * 1000;
const FIRST_CHECK_MS = 30 * 1000;
const DEFAULT_HOUR_UTC = 9;

/** The UTC hour (0–23) after which the day's run may start. */
export function billingHourUtc(raw = process.env.BILLING_JOB_HOUR_UTC): number {
  const hour = Number(raw);
  return raw !== undefined && raw !== "" && Number.isInteger(hour) && hour >= 0 && hour <= 23
    ? hour
    : DEFAULT_HOUR_UTC;
}

/** The day ("YYYY-MM-DD", UTC) whose run is due at `now`, or null if it is too early. */
export function dueBillingDay(now: Date, hourUtc: number): string | null {
  return now.getUTCHours() >= hourUtc ? now.toISOString().slice(0, 10) : null;
}

/** Runs the nightly job if it is due and nobody has run it today. Never throws. */
export async function runBillingIfDue(now: Date = new Date()): Promise<"ran" | "skipped" | "failed"> {
  const day = dueBillingDay(now, billingHourUtc());
  if (!day) return "skipped";

  try {
    if (!(await claimBillingRun(day))) return "skipped";
  } catch (error) {
    console.error("Billing scheduler could not claim the run:", error);
    return "failed";
  }

  try {
    const summary = await runBillingJobs();
    await recordBillingRun(day, { status: "completed", ...summary });
    console.info(`Nightly billing for ${day}:`, JSON.stringify(summary));
    return "ran";
  } catch (error) {
    console.error(`Nightly billing for ${day} failed:`, error);
    await recordBillingRun(day, { status: "failed" }).catch(() => {});
    return "failed";
  }
}

let started = false;

/**
 * Starts the in-process scheduler. The app runs as one long-lived server, so a
 * timer is enough: every few minutes it checks whether today's run is still owed.
 * The database claim makes this safe across restarts and multiple instances.
 */
export function startBillingScheduler() {
  if (started) return;
  started = true;

  const tick = () => {
    void runBillingIfDue();
  };
  // unref: never keep the process alive just for the scheduler
  setTimeout(tick, FIRST_CHECK_MS).unref();
  setInterval(tick, CHECK_EVERY_MS).unref();
  console.info(`Billing scheduler started (daily, from ${billingHourUtc()}:00 UTC).`);
}
