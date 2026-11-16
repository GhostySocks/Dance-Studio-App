"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarPlus, Check, Clock, Loader2, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Modal } from "@/components/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  AttendanceClass,
  MakeupOption,
  StudentAttendance,
  StudentAttendanceRecord,
} from "@/lib/db/student-attendance";
import { cn } from "@/lib/utils";

const STATUS = {
  PRESENT: { label: "Present", icon: Check, className: "bg-green-100 text-green-800" },
  LATE: { label: "Late", icon: Clock, className: "bg-amber-100 text-amber-800" },
  ABSENT: { label: "Absent", icon: X, className: "bg-red-100 text-red-800" },
  EXCUSED: { label: "Excused", icon: AlertCircle, className: "bg-blue-100 text-blue-800" },
} as const;

const PAGE_SIZE = 10;

function formatWhen(iso: string, timeZone?: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

function formatDay(iso: string, timeZone?: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(new Date(iso));
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl border bg-white px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-bold", tone)}>{value}</p>
    </div>
  );
}

/**
 * One student's attendance: totals, every class with submitted attendance, and
 * for each missed class the makeup that is owed, booked or used. Used on the
 * admin student page and in the parent and student portals; the server decides
 * who may see or change what.
 */
export function AttendancePanel({
  attendance,
  onChanged,
  timeZone,
  staff = false,
}: {
  /** Shown to studio staff: they can also count a class that already took place, and undo one */
  staff?: boolean;
  attendance: StudentAttendance;
  /** Called after a makeup is booked or cancelled, to reload the data */
  onChanged: () => void;
  /** Studio timezone; the viewer's own timezone when omitted */
  timeZone?: string;
}) {
  const { student, summary, records } = attendance;
  const [shown, setShown] = useState(PAGE_SIZE);
  const [booking, setBooking] = useState<StudentAttendanceRecord | null>(null);
  const [cancelling, setCancelling] = useState<StudentAttendanceRecord | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  async function cancelMakeup() {
    if (!cancelling?.makeup) return;
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/makeups/${cancelling.makeup.enrollmentId}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof json?.error === "string" ? json.error : "Could not cancel the makeup");
      toast.success("Makeup removed. You can choose another class.");
      setCancelling(null);
      onChanged();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not cancel the makeup");
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat
          label="Attended"
          value={summary.attendedPercent === null ? "-" : `${summary.attendedPercent}%`}
        />
        <Stat label="Present" value={summary.present} tone="text-green-700" />
        <Stat label="Late" value={summary.late} tone="text-amber-700" />
        <Stat label="Absent" value={summary.absent} tone="text-red-700" />
        <Stat label="Excused" value={summary.excused} tone="text-blue-700" />
      </div>

      {summary.makeupsAvailable > 0 && (
        <p className="flex items-center gap-2 rounded-xl border border-domain-schedule-icon/30 bg-domain-schedule px-4 py-3 text-sm text-domain-schedule-foreground">
          <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            <strong>
              {summary.makeupsAvailable} makeup {summary.makeupsAvailable === 1 ? "class" : "classes"}
            </strong>{" "}
            available. Choose <em>Book makeup</em> beside a missed class to pick another class to attend,
            at no charge.
          </span>
        </p>
      )}

      {records.length === 0 ? (
        <p className="rounded-xl border bg-white py-8 text-center text-sm text-muted-foreground">
          No attendance has been recorded yet. Classes appear here once the teacher submits attendance.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-white">
          {records.slice(0, shown).map((record) => {
            const status = STATUS[record.status];
            const Icon = status.icon;
            return (
              <li key={record.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {record.class.className}
                    {record.wasMakeup && <Badge variant="secondary">Makeup class</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatWhen(record.class.startTime, timeZone)}
                    {record.class.teacherName ? ` · ${record.class.teacherName}` : ""}
                  </p>
                </div>

                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                    status.className
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {status.label}
                </span>

                <div className="flex basis-full items-center justify-between gap-3 text-xs sm:basis-96 sm:justify-end">
                  {record.makeupState === "AVAILABLE" && (
                    <Button variant="outline" size="sm" onClick={() => setBooking(record)}>
                      <CalendarPlus className="mr-1 h-3.5 w-3.5" aria-hidden />
                      Book makeup
                      <span className="sr-only">
                        {" "}
                        for {record.class.className} on {formatDay(record.class.startTime, timeZone)}
                      </span>
                    </Button>
                  )}
                  {record.makeupState === "BOOKED" && record.makeup && (
                    <>
                      <span className="text-muted-foreground sm:text-right">
                        Makeup booked:{" "}
                        <span className="font-medium text-foreground">{record.makeup.className}</span>,{" "}
                        {formatWhen(record.makeup.startTime, timeZone)}
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => setCancelling(record)}>
                        <RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden />
                        Change
                        <span className="sr-only"> the makeup for {record.class.className}</span>
                      </Button>
                    </>
                  )}
                  {record.makeupState === "USED" && record.makeup && (
                    <>
                      <span className="text-muted-foreground sm:text-right">
                        Made up: {record.makeup.className}, {formatDay(record.makeup.startTime, timeZone)}
                      </span>
                      {staff && (
                        <Button variant="ghost" size="sm" onClick={() => setCancelling(record)}>
                          Undo
                          <span className="sr-only"> the makeup for {record.class.className}</span>
                        </Button>
                      )}
                    </>
                  )}
                  {record.makeupState === "NOT_ELIGIBLE" && (
                    <span className="text-muted-foreground sm:text-right">
                      A missed makeup cannot be made up again
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {records.length > shown && (
        <div className="text-center">
          <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE_SIZE)}>
            Show earlier classes ({records.length - shown} more)
          </Button>
        </div>
      )}

      <BookMakeupModal
        record={booking}
        studentId={student.id}
        studentName={student.firstName}
        timeZone={timeZone}
        staff={staff}
        onClose={() => setBooking(null)}
        onBooked={() => {
          setBooking(null);
          onChanged();
        }}
      />

      <Modal
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        title={cancelling?.makeupState === "USED" ? "Undo this makeup?" : "Change this makeup?"}
        description={
          cancelling?.makeup
            ? cancelling.makeupState === "USED"
              ? `${cancelling.makeup.className} on ${formatWhen(cancelling.makeup.startTime, timeZone)} will no longer count as ${student.firstName}'s makeup, and the attendance recorded for it will be removed. The missed class can then be made up with a different class.`
              : `${student.firstName} will be taken out of ${cancelling.makeup.className} on ${formatWhen(cancelling.makeup.startTime, timeZone)}. You can then book a different class as the makeup.`
            : undefined
        }
        className="max-w-md"
      >
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => setCancelling(null)} disabled={isCancelling}>
            Keep it
          </Button>
          <Button onClick={cancelMakeup} disabled={isCancelling}>
            {isCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {cancelling?.makeupState === "USED" ? "Undo makeup" : "Cancel this makeup"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function optionLabel(option: AttendanceClass, timeZone?: string) {
  return `${option.className}, ${formatWhen(option.startTime, timeZone)}`;
}

/** Pick an upcoming class with a free spot to attend in place of the missed one. */
function BookMakeupModal({
  record,
  studentId,
  studentName,
  timeZone,
  staff,
  onClose,
  onBooked,
}: {
  record: StudentAttendanceRecord | null;
  studentId: string;
  studentName: string;
  timeZone?: string;
  staff: boolean;
  onClose: () => void;
  onBooked: () => void;
}) {
  const [options, setOptions] = useState<MakeupOption[] | null>(null);
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [when, setWhen] = useState<"upcoming" | "past">("upcoming");
  const open = record !== null;
  const past = when === "past";

  // Always start on upcoming classes
  useEffect(() => {
    if (open) {
      setWhen("upcoming");
      setSearch("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let ignore = false;
    setOptions(null);
    setChosen(null);
    fetch(`/api/makeups/options?studentId=${encodeURIComponent(studentId)}&when=${when}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed");
        const json = await res.json();
        if (!ignore) setOptions(json.data);
      })
      .catch(() => {
        if (!ignore) {
          setOptions([]);
          toast.error("Could not load the classes available");
        }
      });
    return () => {
      ignore = true;
    };
  }, [open, studentId, when]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!options) return [];
    if (!term) return options;
    return options.filter((option) =>
      [option.className, option.danceStyle, option.skillLevel, option.teacherName]
        .filter(Boolean)
        .some((text) => (text as string).toLowerCase().includes(term))
    );
  }, [options, search]);

  async function book() {
    if (!record || !chosen) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/makeups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId: record.id, sessionId: chosen }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof json?.error === "string" ? json.error : "Could not book the makeup");
      const option = options?.find((o) => o.sessionId === chosen);
      toast.success(past ? "Counted as a makeup" : "Makeup booked", {
        description: option
          ? past
            ? `${studentName} is marked present in ${optionLabel(option, timeZone)}.`
            : `${studentName} is in ${optionLabel(option, timeZone)}.`
          : undefined,
      });
      onBooked();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not book the makeup");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Book a makeup class"
      description={
        record
          ? `In place of ${record.class.className} on ${formatDay(record.class.startTime, timeZone)}. ${
              past
                ? `Pick the class ${studentName} attended without being booked. They will be marked present in it.`
                : "Pick any upcoming class with a free spot."
            } There is no charge.`
          : undefined
      }
      className="max-w-xl"
    >
      <div className="space-y-4">
        {staff && (
          <div
            role="group"
            aria-label="Which classes to choose from"
            className="inline-flex rounded-full border border-border bg-white p-0.5"
          >
            {(
              [
                ["upcoming", "Upcoming classes"],
                ["past", "Past classes"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={when === value}
                onClick={() => setWhen(value)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  when === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="makeup-search">Find a class</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="makeup-search"
              className="pl-9"
              placeholder="Class, style, level or teacher"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {options === null ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading classes…
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {options.length > 0
              ? "No classes match your search."
              : past
                ? "No classes in the last eight weeks that this student was not already booked into."
                : "There are no upcoming classes with a free spot right now. Please check again later."}
          </p>
        ) : (
          <div
            role="radiogroup"
            aria-label="Classes available for the makeup"
            className="max-h-80 space-y-2 overflow-y-auto pr-1"
          >
            {filtered.map((option) => {
              const checked = chosen === option.sessionId;
              return (
                <button
                  key={option.sessionId}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => setChosen(option.sessionId)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    checked ? "border-primary bg-accent" : "border-border bg-white hover:bg-muted"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{option.className}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatWhen(option.startTime, timeZone)}
                      {option.teacherName ? ` · ${option.teacherName}` : ""} · {option.roomName}
                    </span>
                    {(option.danceStyle || option.skillLevel) && (
                      <span className="block text-xs text-muted-foreground">
                        {[option.danceStyle, option.skillLevel].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                  {!past && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {option.spotsLeft} {option.spotsLeft === 1 ? "spot" : "spots"} left
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={book} disabled={!chosen || isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {past ? "Count as makeup" : "Book makeup"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
