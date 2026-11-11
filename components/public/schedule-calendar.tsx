"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { SessionRow } from "@/components/public/session-row";
import { WEEKDAYS, dayLabel, monthGrid, monthLabel, monthOf, monthsBetween } from "@/lib/calendar-grid";
import type { PublicSession } from "@/lib/db/public";
import { dayKey } from "@/lib/schedule-format";
import { cn } from "@/lib/utils";

/** How many classes a day cell names before it says "+N more". */
const MAX_CHIPS = 3;

function startTime(session: PublicSession, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone })
    .format(new Date(session.startTime))
    .replace(":00", "")
    .replace(" ", "")
    .toLowerCase();
}

/**
 * Month calendar of upcoming classes. Each day shows its classes; choosing a day
 * lists them underneath with their Register buttons. Days are the studio's
 * calendar days, whatever timezone the visitor is in.
 */
export function ScheduleCalendar({
  sessions,
  timeZone,
}: {
  /** Already filtered, soonest first. */
  sessions: PublicSession[];
  timeZone: string;
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, PublicSession[]>();
    for (const session of sessions) {
      const key = dayKey(session.startTime, timeZone);
      map.set(key, [...(map.get(key) ?? []), session]);
    }
    return map;
  }, [sessions, timeZone]);

  const today = dayKey(new Date().toISOString(), timeZone);
  const dayKeys = useMemo(() => Array.from(byDay.keys()).sort(), [byDay]);
  const firstDay = dayKeys[0] ?? today;
  const lastDay = dayKeys[dayKeys.length - 1] ?? today;

  // The months that can be paged through: from this month to the last class
  const months = useMemo(
    () => monthsBetween(monthOf(today < firstDay ? today : firstDay), monthOf(lastDay)),
    [today, firstDay, lastDay]
  );

  const [month, setMonth] = useState(monthOf(firstDay));
  const [selected, setSelected] = useState<string | null>(dayKeys.length > 0 ? firstDay : null);

  // Changing the filters can remove the selected day or the month being shown:
  // fall back to the first day that still has classes
  useEffect(() => {
    const monthGone = !months.includes(month);
    const dayGone = selected !== null && !byDay.has(selected);
    if (!monthGone && !dayGone) return;
    setMonth(monthOf(firstDay));
    setSelected(byDay.size > 0 ? firstDay : null);
  }, [months, month, selected, byDay, firstDay]);

  const monthIndex = months.indexOf(month);
  const weeks = useMemo(() => monthGrid(month), [month]);
  const selectedSessions = selected ? (byDay.get(selected) ?? []) : [];

  function goTo(index: number) {
    const next = months[index];
    if (!next) return;
    setMonth(next);
    // Jump the day list to that month's first day with classes
    const first = dayKeys.find((k) => monthOf(k) === next);
    setSelected(first ?? null);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/50 bg-white p-3 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 aria-live="polite" className="text-lg font-semibold">
            {monthLabel(month)}
          </h2>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => goTo(monthIndex - 1)}
              disabled={monthIndex <= 0}
              aria-label="Previous month"
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => goTo(monthIndex + 1)}
              disabled={monthIndex >= months.length - 1}
              aria-label="Next month"
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        <div role="grid" aria-label={`Classes in ${monthLabel(month)}`}>
          <div role="row" className="grid grid-cols-7 border-b pb-2">
            {WEEKDAYS.map((weekday) => (
              <div
                key={weekday}
                role="columnheader"
                aria-label={weekday}
                className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                <span aria-hidden>{weekday.slice(0, 3)}</span>
              </div>
            ))}
          </div>

          {weeks.map((week) => (
            <div key={week[0].key} role="row" className="grid grid-cols-7">
              {week.map((day) => {
                const classes = day.inMonth ? (byDay.get(day.key) ?? []) : [];
                const isSelected = selected === day.key;
                const isToday = day.key === today;
                const dayNumber = (
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                      isToday && "bg-primary text-primary-foreground",
                      !isToday && !day.inMonth && "text-muted-foreground/50"
                    )}
                  >
                    {day.dayOfMonth}
                  </span>
                );

                if (classes.length === 0) {
                  return (
                    <div
                      key={day.key}
                      role="gridcell"
                      aria-label={day.inMonth ? `${dayLabel(day.key)}, no classes` : undefined}
                      aria-hidden={!day.inMonth || undefined}
                      className="min-h-16 border-b border-r p-1 last:border-r-0 sm:min-h-24 sm:p-1.5"
                    >
                      {dayNumber}
                    </div>
                  );
                }

                return (
                  <div key={day.key} role="gridcell" className="border-b border-r last:border-r-0">
                    <button
                      type="button"
                      onClick={() => setSelected(day.key)}
                      aria-pressed={isSelected}
                      aria-label={`${dayLabel(day.key)}${isToday ? ", today" : ""}, ${classes.length} class${classes.length === 1 ? "" : "es"}`}
                      className={cn(
                        "flex h-full min-h-16 w-full flex-col items-start gap-1 p-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-24 sm:p-1.5",
                        isSelected ? "bg-accent" : "hover:bg-muted"
                      )}
                    >
                      {dayNumber}

                      {/* Phones: a count. Wider screens: the classes by name. */}
                      <span
                        aria-hidden
                        className="rounded-full bg-domain-classes px-1.5 text-[11px] font-semibold text-domain-classes-foreground sm:hidden"
                      >
                        {classes.length}
                      </span>
                      <span aria-hidden className="hidden w-full flex-col gap-0.5 sm:flex">
                        {classes.slice(0, MAX_CHIPS).map((session) => (
                          <span
                            key={session.id}
                            className={cn(
                              "block truncate rounded px-1 py-0.5 text-[11px] leading-tight",
                              session.spotsLeft > 0
                                ? "bg-domain-classes text-domain-classes-foreground"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            <span className="font-semibold">{startTime(session, timeZone)}</span>{" "}
                            {session.template.name}
                          </span>
                        ))}
                        {classes.length > MAX_CHIPS && (
                          <span className="px-1 text-[11px] text-muted-foreground">
                            +{classes.length - MAX_CHIPS} more
                          </span>
                        )}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <section aria-live="polite" aria-label={selected ? `Classes on ${dayLabel(selected)}` : "Classes"}>
        {selected && selectedSessions.length > 0 ? (
          <>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {dayLabel(selected)}
            </h2>
            <div className="divide-y rounded-2xl border border-border/50 bg-white shadow-sm">
              {selectedSessions.map((session) => (
                <SessionRow key={session.id} session={session} timeZone={timeZone} />
              ))}
            </div>
          </>
        ) : (
          <p className="rounded-2xl bg-white p-8 text-center text-muted-foreground shadow-sm">
            {sessions.length === 0
              ? "No classes match. Try clearing the filters."
              : "No classes this month. Use the arrows to see another month."}
          </p>
        )}
      </section>
    </div>
  );
}
