/**
 * Runs once when the Next.js server process starts.
 * Starts the nightly billing scheduler on the production Node server only:
 * not in dev, not during `next build`, not in the edge runtime (middleware).
 * Set DISABLE_BILLING_SCHEDULER=1 to turn it off, e.g. if an external cron
 * calls /api/cron/billing instead.
 */
export async function register() {
  // Keep this exact check on its own: Next.js uses it to leave the Node-only
  // import below out of the edge bundle.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (
      process.env.NODE_ENV !== "production" ||
      process.env.NEXT_PHASE === "phase-production-build" ||
      process.env.DISABLE_BILLING_SCHEDULER === "1"
    ) {
      return;
    }

    const { startBillingScheduler } = await import("./lib/billing-scheduler");
    startBillingScheduler();
  }
}
