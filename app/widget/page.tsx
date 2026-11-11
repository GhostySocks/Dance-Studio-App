import type { Metadata } from "next";

import { getPublicSchedule, getPublicStudio } from "@/lib/db/public";
import { formatTimeRange, groupByDay, spotsLabel } from "@/lib/schedule-format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Class schedule",
  robots: { index: false },
};

/**
 * Embeddable schedule, meant to be loaded in an iframe on another website:
 *   <iframe src="https://<app>/widget" title="Class schedule" style="width:100%;height:600px;border:0"></iframe>
 * Optional query: ?days=14 (1–56). Links open the full site in a new tab.
 */
export default async function WidgetPage({
  searchParams,
}: {
  searchParams: { days?: string | string[] };
}) {
  const requested = Number(typeof searchParams.days === "string" ? searchParams.days : 14);
  const days = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 56) : 14;

  const [studio, sessions] = await Promise.all([getPublicStudio(), getPublicSchedule({ days })]);
  const grouped = groupByDay(sessions, studio.timezone);

  return (
    <main className="min-h-screen bg-white p-4 text-sm">
      <h1 className="text-base font-semibold">{studio.name} schedule</h1>

      {grouped.length === 0 ? (
        <p className="mt-4 text-muted-foreground">No upcoming classes are scheduled yet.</p>
      ) : (
        grouped.map((day) => (
          <section key={day.key} aria-label={day.heading} className="mt-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {day.heading}
            </h2>
            <ul className="mt-2 divide-y rounded-xl border">
              {day.sessions.map((session) => (
                <li key={session.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium">{session.template.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimeRange(session.startTime, session.endTime, studio.timezone)} ·{" "}
                      {session.teacherName} · {spotsLabel(session.spotsLeft)}
                    </p>
                  </div>
                  <a
                    href={
                      session.template.dropInEnabled
                        ? `/register?session=${session.id}`
                        : `/classes/${session.template.id}#register`
                    }
                    target="_blank"
                    rel="noopener"
                    className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {!session.template.dropInEnabled
                      ? "Register for term"
                      : session.spotsLeft > 0
                        ? "Register"
                        : "Join waitlist"}
                    <span className="sr-only"> for {session.template.name} (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
