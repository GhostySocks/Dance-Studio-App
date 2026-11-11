"use client";

import { useMemo, useState } from "react";
import { CalendarDays, List, Search } from "lucide-react";

import { ScheduleCalendar } from "@/components/public/schedule-calendar";

import { SessionRow } from "@/components/public/session-row";
import { Input } from "@/components/ui/input";
import type { PublicSession } from "@/lib/db/public";
import { groupByDay } from "@/lib/schedule-format";
import { cn } from "@/lib/utils";

function FilterChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  if (options.length < 2) return null;
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {[null, ...options].map((option) => {
        const active = value === option;
        return (
          <button
            key={option ?? "all"}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-white text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {option ?? "All"}
          </button>
        );
      })}
    </div>
  );
}

export type ScheduleView = "list" | "calendar";

function ViewToggle({ view, onChange }: { view: ScheduleView; onChange: (view: ScheduleView) => void }) {
  const options = [
    { value: "list", label: "List", icon: List },
    { value: "calendar", label: "Calendar", icon: CalendarDays },
  ] as const;
  return (
    <div role="group" aria-label="Schedule view" className="inline-flex rounded-full border border-border bg-white p-0.5">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          onClick={() => onChange(value)}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            view === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * Upcoming sessions with search and style/level filters, shown either as a list
 * grouped by day or as a month calendar. The filters apply to both views.
 */
export function ScheduleBrowser({
  sessions,
  timeZone,
  compact = false,
  initialView = "list",
}: {
  sessions: PublicSession[];
  timeZone: string;
  /** Hide search, filters and the view toggle (used by the embeddable widget). */
  compact?: boolean;
  /** From the page URL (?view=calendar), so a link can open straight on the calendar. */
  initialView?: ScheduleView;
}) {
  const [view, setView] = useState<ScheduleView>(initialView);

  function changeView(next: ScheduleView) {
    setView(next);
    // Keep the choice in the address bar so it survives a refresh and can be shared
    const url = new URL(window.location.href);
    if (next === "calendar") url.searchParams.set("view", "calendar");
    else url.searchParams.delete("view");
    window.history.replaceState(null, "", url);
  }

  const [search, setSearch] = useState("");
  const [style, setStyle] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);

  const styles = useMemo(
    () => Array.from(new Set(sessions.flatMap((s) => s.template.danceStyle ?? []))).sort(),
    [sessions]
  );
  const levels = useMemo(
    () => Array.from(new Set(sessions.flatMap((s) => s.template.skillLevel ?? []))).sort(),
    [sessions]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sessions.filter(
      (s) =>
        (!style || s.template.danceStyle === style) &&
        (!level || s.template.skillLevel === level) &&
        (!term ||
          s.template.name.toLowerCase().includes(term) ||
          s.teacherName.toLowerCase().includes(term))
    );
  }, [sessions, search, style, level]);

  const days = useMemo(() => groupByDay(filtered, timeZone), [filtered, timeZone]);

  return (
    <div className="space-y-6">
      {!compact && (
        <div className="space-y-3 rounded-2xl border border-border/50 bg-white p-4 shadow-sm">
          <div className="relative max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              aria-label="Search classes or teachers"
              placeholder="Search classes or teachers"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <FilterChips label="Style" options={styles} value={style} onChange={setStyle} />
          <FilterChips label="Level" options={levels} value={level} onChange={setLevel} />
        </div>
      )}

      {!compact && (
        <div className="flex justify-end">
          <ViewToggle view={view} onChange={changeView} />
        </div>
      )}

      {view === "calendar" && !compact ? (
        <ScheduleCalendar sessions={filtered} timeZone={timeZone} />
      ) : days.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-muted-foreground shadow-sm">
          {sessions.length === 0
            ? "No upcoming classes are scheduled yet."
            : "No classes match your filters."}
        </p>
      ) : (
        days.map((day) => (
          <section key={day.key} aria-label={day.heading}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {day.heading}
            </h2>
            <div className="divide-y rounded-2xl border border-border/50 bg-white shadow-sm">
              {day.sessions.map((session) => (
                <SessionRow key={session.id} session={session} timeZone={timeZone} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
