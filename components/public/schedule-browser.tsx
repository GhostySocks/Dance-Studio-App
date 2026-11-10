"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

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

/** Upcoming sessions grouped by day, with search and style/level filters. */
export function ScheduleBrowser({
  sessions,
  timeZone,
  compact = false,
}: {
  sessions: PublicSession[];
  timeZone: string;
  /** Hide search and filters (used by the embeddable widget). */
  compact?: boolean;
}) {
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

  const days = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = sessions.filter(
      (s) =>
        (!style || s.template.danceStyle === style) &&
        (!level || s.template.skillLevel === level) &&
        (!term ||
          s.template.name.toLowerCase().includes(term) ||
          s.teacherName.toLowerCase().includes(term))
    );
    return groupByDay(filtered, timeZone);
  }, [sessions, search, style, level, timeZone]);

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

      {days.length === 0 ? (
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
