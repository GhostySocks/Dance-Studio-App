"use client";

import type { z } from "zod";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CalendarOff, Plus, Loader2, Clock, MapPin, User, Users } from "lucide-react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventContentArg, DatesSetArg } from "@fullcalendar/core";

import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { StyledSelect } from "@/components/styled-select";

import {
  classSessionSchema,
  type ClassSessionFormData,
} from "@/lib/validations/class";
import { RequiredMark, RequiredNote } from "@/components/required-mark";
import { addDays, closureLength, closureRangeLabel } from "@/lib/closures";
import { closureSchema, type ClosureFormData } from "@/lib/validations/closure";

interface Closure {
  id: string;
  name: string;
  startDay: string;
  endDay: string;
}

/** A class on the calendar: a soft tint of its style colour with a solid edge. */
function renderEvent(arg: EventContentArg) {
  const closure = arg.event.extendedProps.closure as Closure | undefined;
  if (closure) {
    return (
      <div className="flex items-center gap-1.5 truncate px-2 py-0.5 text-xs font-semibold">
        <CalendarOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">Closed: {closure.name}</span>
      </div>
    );
  }
  const session = arg.event.extendedProps as Session;
  const color = getStyleColor(session.template?.danceStyle ?? null);
  const month = arg.view.type === "dayGridMonth";
  return (
    <div
      className="h-full overflow-hidden rounded-md px-1.5 py-1 text-[11px] leading-tight"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 16%, white)`,
        borderLeft: `3px solid ${color}`,
        color: `color-mix(in srgb, ${color} 45%, #0b1f2a)`,
      }}
    >
      <p className="truncate font-semibold">
        {month && <span className="font-normal">{arg.timeText} </span>}
        {session.template?.name}
        {month && session.substituteFor ? " (sub)" : ""}
      </p>
      {!month && (
        <>
          <p className="truncate opacity-80">{arg.timeText}</p>
          <p className="truncate opacity-80">
            {session.substituteFor ? "Sub: " : ""}
            {session.teacher?.user.name ?? "Unknown"} · {session.room?.name}
          </p>
        </>
      )}
    </div>
  );
}

interface Session {
  id: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  notes: string | null;
  template: {
    id: string;
    name: string;
    danceStyle: string | null;
    skillLevel: string | null;
  };
  teacher: {
    id: string;
    user: { name: string | null };
  };
  /** The regular teacher, when a substitute (the `teacher` above) is covering this date */
  substituteFor?: { id: string; user: { name: string | null } } | null;
  substituteReason?: string | null;
  room: {
    id: string;
    name: string;
    capacity: number;
  };
  _count?: { enrollments: number };
  /** Active enrollments, as the sessions API returns them */
  enrollments?: { id: string }[];
}

interface ClassTemplate {
  id: string;
  name: string;
  danceStyle: string | null;
  defaultDurationMins: number;
}

interface Teacher {
  id: string;
  user: { name: string | null };
}

interface Room {
  id: string;
  name: string;
  capacity: number;
}

function getStyleColor(style: string | null): string {
  const colors: Record<string, string> = {
    Ballet: "#ec4899",
    "Hip Hop": "#8b5cf6",
    Jazz: "#f59e0b",
    Contemporary: "#06b6d4",
    Tap: "#10b981",
    Modern: "#6366f1",
    Lyrical: "#f43f5e",
  };
  return colors[style ?? ""] ?? "#6b7280";
}

export default function SchedulePage() {
  const calendarRef = useRef<FullCalendar>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [templates, setTemplates] = useState<ClassTemplate[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  const [dateRange, setDateRange] = useState<{
    start: string;
    end: string;
  } | null>(null);

  const [subTeacherId, setSubTeacherId] = useState("");
  const [subReason, setSubReason] = useState("");
  const [subBusy, setSubBusy] = useState(false);

  const [closures, setClosures] = useState<Closure[]>([]);
  const [closureOpen, setClosureOpen] = useState(false);
  const [detailClosure, setDetailClosure] = useState<Closure | null>(null);
  const [closureBusy, setClosureBusy] = useState(false);
  const closureForm = useForm<ClosureFormData>({
    resolver: zodResolver(closureSchema),
    defaultValues: { name: "", startDay: "", endDay: "" },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailSession, setDetailSession] = useState<Session | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ClassSessionFormData, unknown, z.output<typeof classSessionSchema>>({
    resolver: zodResolver(classSessionSchema),
    defaultValues: {
      templateId: "",
      teacherId: "",
      roomId: "",
      startTime: "",
      endTime: "",
      maxCapacity: 20,
      notes: "",
      isRecurring: false,
      weekCount: 1,
    },
  });

  const isRecurring = form.watch("isRecurring");

  // Separate date/time state for 30-min slot picking
  const [sessionDate, setSessionDate] = useState("");
  const [startSlot, setStartSlot] = useState("");
  const [endSlot, setEndSlot] = useState("");

  const timeSlots = (() => {
    const slots: { value: string; label: string }[] = [];
    for (let h = 6; h < 22; h++) {
      for (const m of [0, 30]) {
        const hh = String(h).padStart(2, "0");
        const mm = String(m).padStart(2, "0");
        const value = `${hh}:${mm}`;
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 || 12;
        const label = `${h12}:${mm} ${ampm}`;
        slots.push({ value, label });
      }
    }
    return slots;
  })();

  // Sync date+time slots into form's startTime/endTime
  useEffect(() => {
    if (sessionDate && startSlot) {
      form.setValue("startTime", `${sessionDate}T${startSlot}`);
    }
  }, [sessionDate, startSlot, form]);

  useEffect(() => {
    if (sessionDate && endSlot) {
      form.setValue("endTime", `${sessionDate}T${endSlot}`);
    }
  }, [sessionDate, endSlot, form]);

  const fetchSessions = useCallback(async () => {
    if (!dateRange) return;
    try {
      const params = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      const res = await fetch(`/api/sessions?${params}`);
      if (!res.ok) throw new Error("Failed to fetch sessions");
      const json = await res.json();
      setSessions(Array.isArray(json.data) ? json.data : json.data.sessions ?? []);
    } catch {
      toast.error("Failed to load sessions");
    }
  }, [dateRange]);

  const fetchDropdownData = useCallback(async () => {
    try {
      const [templatesRes, teachersRes, roomsRes] = await Promise.all([
        fetch("/api/classes?perPage=100"),
        fetch("/api/teachers?perPage=100"),
        fetch("/api/rooms?perPage=100"),
      ]);

      if (templatesRes.ok) {
        const json = await templatesRes.json();
        setTemplates(json.data.templates ?? []);
      }
      if (teachersRes.ok) {
        const json = await teachersRes.json();
        setTeachers(json.data.teachers ?? []);
      }
      if (roomsRes.ok) {
        const json = await roomsRes.json();
        setRooms(json.data.rooms ?? []);
      }
    } catch {
      toast.error("Failed to load form data");
    }
  }, []);

  const fetchClosures = useCallback(async () => {
    if (!dateRange) return;
    try {
      const params = new URLSearchParams({
        from: dateRange.start.slice(0, 10),
        to: dateRange.end.slice(0, 10),
      });
      const res = await fetch(`/api/closures?${params}`);
      if (!res.ok) throw new Error("Failed");
      setClosures((await res.json()).data);
    } catch {
      toast.error("Failed to load closures");
    }
  }, [dateRange]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    fetchClosures();
  }, [fetchClosures]);

  /** Assigns the chosen substitute to the open class, or (with no teacher) hands it back. */
  async function saveSubstitute(remove: boolean) {
    if (!detailSession) return;
    setSubBusy(true);
    try {
      const res = await fetch(`/api/sessions/${detailSession.id}/substitute`, {
        method: remove ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: remove ? undefined : JSON.stringify({ teacherId: subTeacherId, reason: subReason || undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof json?.error === "string" ? json.error : "Could not update the substitute");
      toast.success(remove ? "Class handed back to its regular teacher" : "Substitute assigned");
      setDetailSession(null);
      fetchSessions();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not update the substitute");
    } finally {
      setSubBusy(false);
    }
  }

  function openClosureDialog() {
    closureForm.reset({ name: "", startDay: "", endDay: "" });
    setClosureOpen(true);
  }

  async function onSubmitClosure(values: ClosureFormData) {
    setClosureBusy(true);
    try {
      const res = await fetch("/api/closures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof json?.error === "string" ? json.error : "Could not add the closure");
      const affected: number = json.data.classesAffected;
      toast.success("Closure added", {
        description:
          affected > 0
            ? `${affected} class${affected === 1 ? " is" : "es are"} already scheduled on those days. They are hidden from the public schedule but not cancelled.`
            : undefined,
        duration: affected > 0 ? 10000 : undefined,
      });
      setClosureOpen(false);
      fetchClosures();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not add the closure");
    } finally {
      setClosureBusy(false);
    }
  }

  async function removeClosure() {
    if (!detailClosure) return;
    setClosureBusy(true);
    try {
      const res = await fetch(`/api/closures/${detailClosure.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Closure removed");
      setDetailClosure(null);
      fetchClosures();
    } catch {
      toast.error("Could not remove the closure");
    } finally {
      setClosureBusy(false);
    }
  }

  useEffect(() => {
    fetchDropdownData();
  }, [fetchDropdownData]);

  function handleDatesSet(arg: DatesSetArg) {
    setDateRange({
      start: arg.startStr,
      end: arg.endStr,
    });
  }

  function handleEventClick(arg: EventClickArg) {
    const closure = arg.event.extendedProps.closure as Closure | undefined;
    if (closure) {
      setDetailClosure(closure);
      return;
    }
    const session = arg.event.extendedProps as Session;
    setSubTeacherId("");
    setSubReason("");
    setDetailSession({
      ...session,
      id: arg.event.id,
      startTime: arg.event.startStr,
      endTime: arg.event.endStr,
    });
  }

  function openAddDialog() {
    form.reset({
      templateId: "",
      teacherId: "",
      roomId: "",
      startTime: "",
      endTime: "",
      maxCapacity: 20,
      notes: "",
      isRecurring: false,
      weekCount: 1,
    });
    setSessionDate("");
    setStartSlot("");
    setEndSlot("");
    setDialogOpen(true);
  }

  async function onSubmit(data: Record<string, unknown>) {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.status === 409) {
        toast.error("Room is already booked for this time");
        return;
      }

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.toString() || "Request failed");
      }

      toast.success("Session created successfully");
      setDialogOpen(false);
      fetchSessions();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const events = sessions.map((s) => ({
    id: s.id,
    title: `${s.template.name} - ${s.teacher.user.name ?? "Unknown"}`,
    start: s.startTime,
    end: s.endTime,
    extendedProps: { ...s },
    // Drawn by renderEvent, so FullCalendar's own block stays invisible
    backgroundColor: "transparent",
    borderColor: "transparent",
  }));

  // Each closure blocks out its days (striped background) and gets a banner that
  // can be clicked to see or remove it. FullCalendar's end day is exclusive.
  const closureEvents = closures.flatMap((closure) => {
    const range = { start: closure.startDay, end: addDays(closure.endDay), allDay: true };
    return [
      { id: `closed-bg-${closure.id}`, ...range, display: "background", classNames: ["closed-day"] },
      {
        id: `closed-${closure.id}`,
        ...range,
        title: `Closed: ${closure.name}`,
        classNames: ["fc-closure"],
        extendedProps: { closure },
      },
    ];
  });

  return (
    <div>
      <PageHeader title="Schedule" description="Manage class sessions and schedule">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={openClosureDialog}>
            <CalendarOff className="h-4 w-4 mr-2" aria-hidden />
            Add Closure
          </Button>
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" aria-hidden />
            Add Session
          </Button>
        </div>
      </PageHeader>

      <div className="studio-calendar rounded-2xl bg-white p-4 shadow-md sm:p-5">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          buttonText={{ today: "Today", month: "Month", week: "Week", day: "Day" }}
          events={[...events, ...closureEvents]}
          eventContent={renderEvent}
          dayMaxEvents={4}
          allDayText=""
          dayHeaderFormat={{ weekday: "short", month: "numeric", day: "numeric", omitCommas: true }}
          views={{ dayGridMonth: { dayHeaderFormat: { weekday: "short" } } }}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          height="auto"
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          nowIndicator
          eventDisplay="block"
          slotDuration="00:30:00"
        />
      </div>

      {/* Add Session Modal */}
      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Add Session"
        description="Schedule a new class session."
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <RequiredNote />
          <div className="grid gap-2">
            <Label htmlFor="templateId">Class Template<RequiredMark /></Label>
            <StyledSelect
              value={form.watch("templateId")}
              onChange={(val) => form.setValue("templateId", val)}
              placeholder="Select class"
              options={templates.map((t) => ({
                value: t.id,
                label: `${t.name}${t.danceStyle ? ` (${t.danceStyle})` : ""}`,
              }))}
            />
            {form.formState.errors.templateId && (
              <p className="text-xs text-destructive">
                {form.formState.errors.templateId.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="teacherId">Teacher<RequiredMark /></Label>
              <StyledSelect
                value={form.watch("teacherId")}
                onChange={(val) => form.setValue("teacherId", val)}
                placeholder="Select teacher"
                options={teachers.map((t) => ({
                  value: t.id,
                  label: t.user.name ?? "Unknown",
                }))}
              />
              {form.formState.errors.teacherId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.teacherId.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="roomId">Room<RequiredMark /></Label>
              <StyledSelect
                value={form.watch("roomId")}
                onChange={(val) => form.setValue("roomId", val)}
                placeholder="Select room"
                options={rooms.map((r) => ({
                  value: r.id,
                  label: `${r.name} (cap: ${r.capacity})`,
                }))}
              />
              {form.formState.errors.roomId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.roomId.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sessionDate">Date<RequiredMark /></Label>
            <Input
              id="sessionDate" aria-required="true"
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Start Time<RequiredMark /></Label>
              <StyledSelect
                value={startSlot}
                onChange={setStartSlot}
                options={timeSlots}
                placeholder="Select start..."
                maxHeight={240}
              />
              {form.formState.errors.startTime && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.startTime.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>End Time<RequiredMark /></Label>
              <StyledSelect
                value={endSlot}
                onChange={setEndSlot}
                options={timeSlots}
                placeholder="Select end..."
                maxHeight={240}
              />
              {form.formState.errors.endTime && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.endTime.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="maxCapacity">Max Capacity<RequiredMark /></Label>
            <Input
              id="maxCapacity" aria-required="true"
              type="number"
              min={1}
              {...form.register("maxCapacity")}
              aria-invalid={!!form.formState.errors.maxCapacity}
            />
            {form.formState.errors.maxCapacity && (
              <p className="text-xs text-destructive">
                {form.formState.errors.maxCapacity.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...form.register("notes")}
              placeholder="Session notes..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="isRecurring"
              type="checkbox"
              {...form.register("isRecurring")}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="isRecurring" className="font-normal">
              Recurring session
            </Label>
          </div>

          {isRecurring && (
            <div className="grid gap-2">
              <Label htmlFor="weekCount">Number of Weeks<RequiredMark /></Label>
              <Input
                id="weekCount" aria-required="true"
                type="number"
                min={1}
                max={52}
                {...form.register("weekCount")}
                aria-invalid={!!form.formState.errors.weekCount}
              />
              {form.formState.errors.weekCount && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.weekCount.message}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create Session
            </Button>
          </div>
        </form>
      </Modal>

      {/* Session Detail Modal */}
      <Modal
        open={!!detailSession}
        onClose={() => setDetailSession(null)}
        title={detailSession?.template.name ?? "Session Details"}
        description={
          detailSession?.template.danceStyle
            ? `${detailSession.template.danceStyle}${detailSession.template.skillLevel ? ` - ${detailSession.template.skillLevel}` : ""}`
            : undefined
        }
      >
        {detailSession && (
          <div className="grid gap-4">
            {detailSession.template.danceStyle && (
              <Badge
                variant="secondary"
                className="w-fit"
                style={{
                  backgroundColor: getStyleColor(
                    detailSession.template.danceStyle
                  ),
                  color: "#fff",
                }}
              >
                {detailSession.template.danceStyle}
              </Badge>
            )}

            <div className="grid gap-3 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Teacher:</span>
                <span className="font-medium">
                  {detailSession.teacher.user.name ?? "Unknown"}
                </span>
                {detailSession.substituteFor && <Badge variant="secondary">Substitute</Badge>}
              </div>
              {detailSession.substituteFor && (
                <p className="-mt-1 pl-6 text-xs text-muted-foreground">
                  Covering for {detailSession.substituteFor.user.name ?? "the regular teacher"}
                  {detailSession.substituteReason ? ` · ${detailSession.substituteReason}` : ""}
                </p>
              )}

              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Room:</span>
                <span className="font-medium">
                  {detailSession.room.name}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Time:</span>
                <span className="font-medium">
                  {formatDateTime(detailSession.startTime)} -{" "}
                  {formatDateTime(detailSession.endTime)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Enrolled:</span>
                <span className="font-medium">
                  {detailSession._count?.enrollments ?? detailSession.enrollments?.length ?? 0} /{" "}
                  {detailSession.maxCapacity}
                </span>
              </div>

              {detailSession.notes && (
                <div className="pt-2 border-t">
                  <p className="text-muted-foreground mb-1">Notes:</p>
                  <p>{detailSession.notes}</p>
                </div>
              )}
            </div>

            <div className="grid gap-3 rounded-xl border bg-muted/40 p-4">
              <h3 className="text-sm font-semibold">
                {detailSession.substituteFor ? "Change the substitute" : "Substitute teacher"}
              </h3>
              <p className="-mt-2 text-xs text-muted-foreground">
                For when the regular teacher is out. The substitute takes this date only: they see the
                roster, take attendance, and the class counts on their pay report.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Substitute</Label>
                  <StyledSelect
                    value={subTeacherId}
                    onChange={setSubTeacherId}
                    placeholder="Choose a teacher"
                    options={teachers
                      .filter(
                        (t) => t.id !== detailSession.teacher.id && t.id !== detailSession.substituteFor?.id
                      )
                      .map((t) => ({ value: t.id, label: t.user.name ?? "Teacher" }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sub-reason">Reason (optional)</Label>
                  <Input
                    id="sub-reason"
                    placeholder="Out sick"
                    maxLength={200}
                    value={subReason}
                    onChange={(e) => setSubReason(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {detailSession.substituteFor && (
                  <Button variant="outline" size="sm" disabled={subBusy} onClick={() => saveSubstitute(true)}>
                    Remove substitute
                  </Button>
                )}
                <Button size="sm" disabled={subBusy || !subTeacherId} onClick={() => saveSubstitute(false)}>
                  {subBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                  Assign substitute
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setDetailSession(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Closure Modal */}
      <Modal
        open={closureOpen}
        onClose={() => setClosureOpen(false)}
        title="Add a closure"
        description="Block out days the studio is closed, such as a holiday or a break. They show as closed on this calendar and on the public schedule."
        className="max-w-md"
      >
        <form onSubmit={closureForm.handleSubmit(onSubmitClosure)} className="grid gap-4" noValidate>
          <RequiredNote />
          <div className="grid gap-2">
            <Label htmlFor="closure-name">
              Name
              <RequiredMark />
            </Label>
            <Input
              id="closure-name"
              aria-required="true"
              placeholder="Christmas break"
              {...closureForm.register("name")}
            />
            {closureForm.formState.errors.name && (
              <p className="text-xs text-destructive">{closureForm.formState.errors.name.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="closure-start">
                First day closed
                <RequiredMark />
              </Label>
              <Input
                id="closure-start"
                type="date"
                aria-required="true"
                {...closureForm.register("startDay", {
                  // A one-day closure only needs the first date
                  onChange: (e) => {
                    if (!closureForm.getValues("endDay")) closureForm.setValue("endDay", e.target.value);
                  },
                })}
              />
              {closureForm.formState.errors.startDay && (
                <p className="text-xs text-destructive">{closureForm.formState.errors.startDay.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="closure-end">
                Last day closed
                <RequiredMark />
              </Label>
              <Input id="closure-end" type="date" aria-required="true" {...closureForm.register("endDay")} />
              {closureForm.formState.errors.endDay && (
                <p className="text-xs text-destructive">{closureForm.formState.errors.endDay.message}</p>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Classes already scheduled on these days are not cancelled. They are hidden from the public
            schedule so nobody can book them.
          </p>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setClosureOpen(false)} disabled={closureBusy}>
              Cancel
            </Button>
            <Button type="submit" disabled={closureBusy}>
              {closureBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />}
              Add closure
            </Button>
          </div>
        </form>
      </Modal>

      {/* Closure Detail Modal */}
      <Modal
        open={!!detailClosure}
        onClose={() => setDetailClosure(null)}
        title={detailClosure ? `Closed: ${detailClosure.name}` : "Closure"}
        description={
          detailClosure
            ? `${closureRangeLabel(detailClosure)} (${closureLength(detailClosure)} day${closureLength(detailClosure) === 1 ? "" : "s"})`
            : undefined
        }
        className="max-w-md"
      >
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => setDetailClosure(null)} disabled={closureBusy}>
            Close
          </Button>
          <Button variant="destructive" onClick={removeClosure} disabled={closureBusy}>
            {closureBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />}
            Remove closure
          </Button>
        </div>
      </Modal>
    </div>
  );
}
