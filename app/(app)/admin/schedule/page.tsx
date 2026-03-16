"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Loader2, X, Clock, MapPin, User, Users } from "lucide-react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, DatesSetArg } from "@fullcalendar/core";

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
  room: {
    id: string;
    name: string;
    capacity: number;
  };
  _count?: { enrollments: number };
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

function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className={`relative z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-background p-6 shadow-lg ${className ?? ""}`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
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

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailSession, setDetailSession] = useState<Session | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ClassSessionFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(classSessionSchema) as any,
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

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

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
    const session = arg.event.extendedProps as Session;
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
    backgroundColor: getStyleColor(s.template.danceStyle),
    borderColor: getStyleColor(s.template.danceStyle),
  }));

  return (
    <div>
      <PageHeader title="Schedule" description="Manage class sessions and schedule">
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Session
        </Button>
      </PageHeader>

      <div className="rounded-md border bg-background p-4">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "timeGridWeek,timeGridDay",
          }}
          events={events}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          height="auto"
          allDaySlot={false}
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
          <div className="grid gap-2">
            <Label htmlFor="templateId">Class Template</Label>
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
              <Label htmlFor="teacherId">Teacher</Label>
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
              <Label htmlFor="roomId">Room</Label>
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
            <Label htmlFor="sessionDate">Date</Label>
            <Input
              id="sessionDate"
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Start Time</Label>
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
              <Label>End Time</Label>
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
            <Label htmlFor="maxCapacity">Max Capacity</Label>
            <Input
              id="maxCapacity"
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
              <Label htmlFor="weekCount">Number of Weeks</Label>
              <Input
                id="weekCount"
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
              </div>

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
                  {detailSession._count?.enrollments ?? 0} /{" "}
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
    </div>
  );
}
