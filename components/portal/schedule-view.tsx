"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarCheck, Clock, LayoutGrid, Loader2, MapPin, User } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { EmailTeacherButton } from "@/components/email-teacher-button";
import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/page-header";
import { RequiredMark, RequiredNote } from "@/components/required-mark";
import { StyledSelect } from "@/components/styled-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { PortalBrowseSession, PortalClassBrowser, PortalDancer } from "@/lib/db/portal-schedule";
import { bookingChoices, canBookAny } from "@/lib/portal-schedule";
import { formatDayHeading, formatTimeRange, groupByDay, spotsLabel } from "@/lib/schedule-format";
import { cn, formatCurrency } from "@/lib/utils";

interface ScheduleEntry {
  id: string;
  /** Set when this booking is a makeup for a missed class */
  makeupForId: string | null;
  student: { firstName: string; lastName: string };
  session: {
    startTime: string;
    endTime: string;
    template: { name: string; danceStyle: string | null };
    teacher: { id: string; user: { name: string | null } } | null;
    room: { name: string } | null;
  };
}

type View = "mine" | "all";

const FALLBACK_TIME_ZONE = "America/New_York";
const dancerName = (dancer: { firstName: string; lastName: string }) => `${dancer.firstName} ${dancer.lastName}`;
const credit = (dancer: PortalDancer) => ({ id: dancer.id, makeupsAvailable: dancer.makeups.length });

function ViewToggle({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  const options = [
    { value: "mine", label: "My classes", icon: CalendarCheck },
    { value: "all", label: "All classes", icon: LayoutGrid },
  ] as const;
  return (
    <div role="group" aria-label="Which classes to show" className="inline-flex rounded-full border border-border bg-white p-0.5">
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

const bookingSchema = z
  .object({
    studentId: z.string().min(1, "Choose a dancer"),
    how: z.enum(["SINGLE", "MAKEUP"], { message: "Choose how to book" }),
    attendanceId: z.string(),
  })
  .refine((data) => data.how !== "MAKEUP" || data.attendanceId !== "", {
    message: "Choose the missed class this makes up for",
    path: ["attendanceId"],
  });

type BookingValues = z.infer<typeof bookingSchema>;

/** Books one date of a class for one dancer: as a paid single class, or as a makeup. */
function BookingForm({
  session,
  students,
  timeZone,
  onBooked,
  onCancel,
}: {
  session: PortalBrowseSession;
  students: PortalDancer[];
  timeZone: string;
  onBooked: () => void;
  onCancel: () => void;
}) {
  // Dancers who can still do something with this class
  const eligible = students.filter((student) => {
    const choices = bookingChoices({ ...session, dropInEnabled: session.template.dropInEnabled }, credit(student));
    return choices.single !== null || choices.makeup;
  });
  const [isSaving, setIsSaving] = useState(false);
  const {
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BookingValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { studentId: eligible.length === 1 ? eligible[0].id : "", how: undefined, attendanceId: "" },
  });

  const studentId = watch("studentId");
  const how = watch("how");
  const attendanceId = watch("attendanceId");
  const student = eligible.find((s) => s.id === studentId) ?? null;
  const choices = student
    ? bookingChoices({ ...session, dropInEnabled: session.template.dropInEnabled }, credit(student))
    : null;

  // Pick the only way to book when there is just one, and keep the choice valid for the dancer
  useEffect(() => {
    if (!choices || !student) return;
    const single = choices.single !== null;
    if (single && !choices.makeup && how !== "SINGLE") setValue("how", "SINGLE");
    if (!single && choices.makeup && how !== "MAKEUP") setValue("how", "MAKEUP");
    const validCredit = student.makeups.some((makeup) => makeup.attendanceId === attendanceId);
    if (!validCredit) setValue("attendanceId", student.makeups.length === 1 ? student.makeups[0].attendanceId : "");
  }, [choices, student, how, attendanceId, setValue]);

  const shortDate = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone }).format(new Date(iso));

  async function onSubmit(values: BookingValues) {
    setIsSaving(true);
    try {
      const makeup = values.how === "MAKEUP";
      const res = await fetch(makeup ? "/api/makeups" : "/api/portal/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          makeup
            ? { attendanceId: values.attendanceId, sessionId: session.id }
            : { studentIds: [values.studentId], sessionId: session.id }
        ),
      });
      const json = await res.json().catch(() => null);
      const result = Array.isArray(json?.data) ? json.data[0] : null;
      if (!res.ok) {
        throw new Error(result?.error ?? (typeof json?.error === "string" ? json.error : "Could not book the class"));
      }
      toast.success(
        makeup ? "Makeup class booked" : result?.waitlist ? "Added to the waitlist" : "Signed up for the class"
      );
      onBooked();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not book the class");
    } finally {
      setIsSaving(false);
    }
  }

  const optionClass = (selected: boolean) =>
    cn(
      "flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      selected ? "border-primary bg-primary/5" : "hover:bg-accent"
    );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      <RequiredNote />
      {eligible.length > 1 && (
        <div className="grid gap-1.5">
          <Label>
            Dancer
            <RequiredMark />
          </Label>
          <StyledSelect
            value={studentId}
            onChange={(value) => setValue("studentId", value, { shouldValidate: true })}
            options={eligible.map((s) => ({ value: s.id, label: dancerName(s) }))}
            placeholder="Choose a dancer"
          />
          {errors.studentId && <p className="text-xs text-destructive">{errors.studentId.message}</p>}
        </div>
      )}

      {choices && student && (
        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-sm font-medium">
            How would you like to book?
            <RequiredMark />
          </legend>
          {choices.single !== null && (
            <button
              type="button"
              role="radio"
              aria-checked={how === "SINGLE"}
              className={optionClass(how === "SINGLE")}
              onClick={() => setValue("how", "SINGLE", { shouldValidate: true })}
            >
              <span>
                <span className="block font-medium">
                  {choices.single === "OPEN" ? "Single class" : "Join the waitlist"} ·{" "}
                  {formatCurrency(session.template.basePriceCents)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {choices.single === "OPEN"
                    ? "A one-off booking for this date. It is added to your next invoice."
                    : "The class is full. You are only charged if a spot opens up for you."}
                </span>
              </span>
            </button>
          )}
          {choices.makeup && (
            <button
              type="button"
              role="radio"
              aria-checked={how === "MAKEUP"}
              className={optionClass(how === "MAKEUP")}
              onClick={() => setValue("how", "MAKEUP", { shouldValidate: true })}
            >
              <span>
                <span className="block font-medium">Makeup class · no charge</span>
                <span className="block text-xs text-muted-foreground">
                  Counts in place of a class {student.firstName} missed ({student.makeups.length} to make up).
                </span>
              </span>
            </button>
          )}
          {errors.how && <p className="text-xs text-destructive">{errors.how.message}</p>}
        </fieldset>
      )}

      {how === "MAKEUP" && student && student.makeups.length > 1 && (
        <div className="grid gap-1.5">
          <Label>
            Missed class to make up
            <RequiredMark />
          </Label>
          <StyledSelect
            value={attendanceId}
            onChange={(value) => setValue("attendanceId", value, { shouldValidate: true })}
            options={student.makeups.map((makeup) => ({
              value: makeup.attendanceId,
              label: `${makeup.className}, ${shortDate(makeup.startTime)}`,
            }))}
            placeholder="Choose the missed class"
          />
          {errors.attendanceId && <p className="text-xs text-destructive">{errors.attendanceId.message}</p>}
        </div>
      )}
      {how === "MAKEUP" && student && student.makeups.length === 1 && (
        <p className="text-sm text-muted-foreground">
          Makes up for {student.makeups[0].className} on {shortDate(student.makeups[0].startTime)}.
        </p>
      )}

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" variant="cta" disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          {how === "MAKEUP" ? "Book makeup" : choices?.single === "WAITLIST" ? "Join waitlist" : "Sign up"}
        </Button>
      </div>
    </form>
  );
}

export function ScheduleView({ description }: { description: string }) {
  const [view, setView] = useState<View>("mine");
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [browser, setBrowser] = useState<PortalClassBrowser | null>(null);
  const [loading, setLoading] = useState(true);
  const [style, setStyle] = useState("");
  const [booking, setBooking] = useState<PortalBrowseSession | null>(null);

  const load = useCallback(async () => {
    try {
      const [mine, all] = await Promise.all([fetch("/api/parent/schedule"), fetch("/api/portal/schedule")]);
      if (!mine.ok || !all.ok) throw new Error("Failed");
      const [mineJson, allJson] = await Promise.all([mine.json(), all.json()]);
      setEntries(mineJson.data || []);
      setBrowser(allJson.data ?? null);
    } catch {
      toast.error("Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const timeZone = browser?.timeZone ?? FALLBACK_TIME_ZONE;
  const students = useMemo(() => browser?.students ?? [], [browser]);
  const makeupsAvailable = students.reduce((sum, student) => sum + student.makeups.length, 0);

  const styles = useMemo(() => {
    const all = new Set<string>();
    for (const session of browser?.sessions ?? []) if (session.template.danceStyle) all.add(session.template.danceStyle);
    return Array.from(all).sort();
  }, [browser]);

  const mineByDay = useMemo(
    () => groupByDay(entries.map((entry) => ({ ...entry, startTime: entry.session.startTime })), timeZone),
    [entries, timeZone]
  );
  const allByDay = useMemo(
    () =>
      groupByDay(
        (browser?.sessions ?? []).filter((session) => style === "" || session.template.danceStyle === style),
        timeZone
      ),
    [browser, style, timeZone]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        description={view === "mine" ? description : "Every upcoming class at the studio"}
      >
        <ViewToggle view={view} onChange={setView} />
      </PageHeader>

      {view === "mine" ? (
        entries.length === 0 ? (
          <Card>
            <CardContent className="space-y-3 py-8 text-center">
              <p className="text-muted-foreground">No upcoming classes.</p>
              <Button variant="outline" onClick={() => setView("all")}>
                Browse all classes
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {mineByDay.map((day) => (
              <div key={day.key}>
                <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{day.heading}</h3>
                <div className="space-y-2">
                  {day.sessions.map((entry) => (
                    <Card key={entry.id}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <p className="flex flex-wrap items-center gap-2 font-medium">
                              {entry.session.template.name}
                              {entry.makeupForId && <Badge variant="outline">Makeup class</Badge>}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              for {entry.student.firstName} {entry.student.lastName}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" aria-hidden />
                                {formatTimeRange(entry.session.startTime, entry.session.endTime, timeZone)}
                              </span>
                              {entry.session.teacher?.user.name && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" aria-hidden />
                                  {entry.session.teacher.user.name}
                                </span>
                              )}
                              {entry.session.room?.name && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" aria-hidden />
                                  {entry.session.room.name}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {entry.session.template.danceStyle && (
                              <Badge variant="secondary">{entry.session.template.danceStyle}</Badge>
                            )}
                            {entry.session.teacher?.user.name && (
                              <EmailTeacherButton
                                teacherId={entry.session.teacher.id}
                                teacherName={entry.session.teacher.user.name}
                                className={entry.session.template.name}
                              />
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Sign up for a single class
              {makeupsAvailable > 0
                ? `, or use one of your ${makeupsAvailable} makeup ${makeupsAvailable === 1 ? "class" : "classes"}.`
                : ". A missed class can be made up here once your teacher has submitted attendance."}
            </p>
            {styles.length > 1 && (
              <StyledSelect
                className="w-48"
                aria-label="Dance style"
                value={style}
                onChange={setStyle}
                options={[{ value: "", label: "All styles" }, ...styles.map((s) => ({ value: s, label: s }))]}
                placeholder="All styles"
              />
            )}
          </div>

          {allByDay.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">No upcoming classes.</CardContent>
            </Card>
          ) : (
            allByDay.map((day) => (
              <div key={day.key}>
                <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                  {formatDayHeading(day.sessions[0].startTime, timeZone)}
                </h3>
                <div className="space-y-2">
                  {day.sessions.map((session) => {
                    const bookable = canBookAny(
                      { ...session, dropInEnabled: session.template.dropInEnabled },
                      students.map(credit)
                    );
                    const everyoneBooked =
                      students.length > 0 &&
                      students.every((student) => session.booked.some((b) => b.studentId === student.id));
                    return (
                      <Card key={session.id}>
                        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                          <div className="min-w-0 space-y-1">
                            <p className="flex flex-wrap items-center gap-2 font-medium">
                              {session.template.name}
                              {session.template.danceStyle && (
                                <Badge variant="secondary">{session.template.danceStyle}</Badge>
                              )}
                              {session.template.skillLevel && (
                                <Badge variant="outline">{session.template.skillLevel}</Badge>
                              )}
                            </p>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" aria-hidden />
                                {formatTimeRange(session.startTime, session.endTime, timeZone)}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" aria-hidden />
                                {session.teacherName}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" aria-hidden />
                                {session.roomName}
                              </span>
                              <span>{spotsLabel(session.spotsLeft)}</span>
                            </div>
                            {session.booked.length > 0 && (
                              <p className="flex flex-wrap gap-1.5 pt-1">
                                {session.booked.map((b) => {
                                  const student = students.find((s) => s.id === b.studentId);
                                  return (
                                    <Badge key={b.studentId} variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-900">
                                      {students.length > 1 && student ? `${student.firstName}: ` : ""}
                                      {b.status === "WAITLIST" ? "On the waitlist" : b.makeup ? "Makeup booked" : "Booked"}
                                    </Badge>
                                  );
                                })}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            {bookable ? (
                              <Button size="sm" onClick={() => setBooking(session)}>
                                {session.template.dropInEnabled && session.spotsLeft <= 0 ? "Join waitlist" : "Sign up"}
                              </Button>
                            ) : everyoneBooked ? null : (
                              <p className="max-w-44 text-right text-xs text-muted-foreground">
                                {session.template.dropInEnabled ? "Class full" : "Booked by the term"}
                              </p>
                            )}
                            <Link
                              href={`/classes/${session.template.id}`}
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              {session.template.dropInEnabled ? "Class details" : "Register for the term"}
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Modal
        open={booking !== null}
        onClose={() => setBooking(null)}
        title={booking ? `Sign up for ${booking.template.name}` : "Sign up"}
        description={
          booking
            ? `${formatDayHeading(booking.startTime, timeZone)} · ${formatTimeRange(booking.startTime, booking.endTime, timeZone)} · ${booking.teacherName}`
            : undefined
        }
      >
        {booking && (
          <BookingForm
            session={booking}
            students={students}
            timeZone={timeZone}
            onCancel={() => setBooking(null)}
            onBooked={() => {
              setBooking(null);
              load();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
