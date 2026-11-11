"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  X as XIcon,
  Clock,
  AlertCircle,
  Lock,
  Loader2,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StyledSelect } from "@/components/styled-select";

interface Session {
  id: string;
  startTime: string;
  endTime: string;
  template: { name: string };
  room: { name: string };
  enrolled: number;
  /** Attendance already submitted and locked. */
  submitted: boolean;
}

interface AttendanceRecord {
  id: string;
  enrollmentId: string;
  sessionId: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  lockedAt: string | null;
  notes: string | null;
  enrollment: {
    student: {
      id: string;
      firstName: string;
      lastName: string;
      email: string | null;
    };
  };
}

const statusConfig = {
  PRESENT: { icon: Check, color: "text-green-600", bg: "bg-green-100 dark:bg-green-950" },
  ABSENT: { icon: XIcon, color: "text-red-600", bg: "bg-red-100 dark:bg-red-950" },
  LATE: { icon: Clock, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-950" },
  EXCUSED: { icon: AlertCircle, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-950" },
} as const;

/** "Today 4:00 PM", "Yesterday 4:00 PM" or "Mon, Nov 9, 4:00 PM" in the viewer's time. */
function sessionWhen(startTime: string) {
  const start = new Date(startTime);
  const time = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysAgo = Math.round((dayStart(new Date()) - dayStart(start)) / 86400000);
  if (daysAgo === 0) return `Today ${time}`;
  if (daysAgo === 1) return `Yesterday ${time}`;
  return `${start.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}, ${time}`;
}

export default function TeacherAttendancePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  // Track local changes
  const [localStatuses, setLocalStatuses] = useState<
    Record<string, "PRESENT" | "ABSENT" | "LATE" | "EXCUSED">
  >({});

  const fetchAttendance = useCallback(async (sessionId: string) => {
    setLoadingRecords(true);
    try {
      const res = await fetch(`/api/attendance/${sessionId}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      const recs: AttendanceRecord[] = json.data;
      setRecords(recs);
      setIsLocked(recs.some((r) => r.lockedAt !== null));

      // Initialize local statuses
      const statuses: Record<string, "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"> = {};
      for (const r of recs) {
        statuses[r.enrollmentId] = r.status;
      }
      setLocalStatuses(statuses);
    } catch {
      toast.error("Failed to load attendance");
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch("/api/teachers/me/attendance");
        if (!res.ok) {
          toast.error("Failed to load your classes");
          return;
        }
        const list: Session[] = (await res.json()).data;
        setSessions(list);

        // Open the class that is on now, or the one that most recently started
        const now = Date.now();
        const current =
          list.find((s) => new Date(s.startTime).getTime() <= now && now <= new Date(s.endTime).getTime()) ??
          list.find((s) => new Date(s.startTime).getTime() <= now && !s.submitted);
        if (current) {
          setSelectedSessionId(current.id);
          fetchAttendance(current.id);
        }
      } catch {
        toast.error("Failed to load sessions");
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, [fetchAttendance]);


  function selectSession(sessionId: string) {
    setSelectedSessionId(sessionId);
    if (sessionId) {
      fetchAttendance(sessionId);
    } else {
      setRecords([]);
      setLocalStatuses({});
    }
  }

  function setStatus(
    enrollmentId: string,
    status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"
  ) {
    if (isLocked) return;
    setLocalStatuses((prev) => ({ ...prev, [enrollmentId]: status }));
  }

  async function saveAttendance() {
    if (!selectedSessionId) return;
    setSaving(true);
    try {
      const attendanceRecords = Object.entries(localStatuses).map(
        ([enrollmentId, status]) => ({ enrollmentId, status })
      );

      const res = await fetch(`/api/attendance/${selectedSessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: attendanceRecords }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(typeof json.error === "string" ? json.error : "Save failed");
      }

      toast.success("Attendance saved");
      fetchAttendance(selectedSessionId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Save failed";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function submitAndLock() {
    if (!selectedSessionId) return;
    setSubmitting(true);
    try {
      // Save first
      const attendanceRecords = Object.entries(localStatuses).map(
        ([enrollmentId, status]) => ({ enrollmentId, status })
      );
      const saveRes = await fetch(`/api/attendance/${selectedSessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: attendanceRecords }),
      });
      if (!saveRes.ok) throw new Error("Failed to save");

      // Then lock
      const lockRes = await fetch("/api/attendance/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: selectedSessionId }),
      });
      if (!lockRes.ok) throw new Error("Failed to submit");

      toast.success("Attendance submitted and locked");
      setSessions((list) =>
        list.map((x) => (x.id === selectedSessionId ? { ...x, submitted: true } : x))
      );
      fetchAttendance(selectedSessionId);
    } catch {
      toast.error("Failed to submit attendance");
    } finally {
      setSubmitting(false);
    }
  }

  // Count stats
  const presentCount = Object.values(localStatuses).filter((s) => s === "PRESENT").length;
  const absentCount = Object.values(localStatuses).filter((s) => s === "ABSENT").length;
  const lateCount = Object.values(localStatuses).filter((s) => s === "LATE").length;
  const excusedCount = Object.values(localStatuses).filter((s) => s === "EXCUSED").length;

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
        title="Attendance"
        description="Mark and submit attendance for your classes"
      />

      {sessions.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            You have no classes today or in the last two weeks. A class appears here on the day it
            takes place.
          </CardContent>
        </Card>
      )}

      <div className={sessions.length === 0 ? "hidden" : undefined}>
        <label className="text-sm font-medium mb-2 block">Class</label>
        <StyledSelect
          value={selectedSessionId}
          onChange={selectSession}
          options={sessions.map((s) => ({
            value: s.id,
            label: `${s.template.name} — ${sessionWhen(s.startTime)} — ${s.room.name}${s.submitted ? " (submitted)" : ""}`,
          }))}
          placeholder="Choose a class..."
          maxHeight={320}
          className="w-full max-w-md"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Showing your classes from today and the last two weeks. For anything older, ask an admin.
        </p>
      </div>

      {selectedSessionId && loadingRecords && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {selectedSessionId && !loadingRecords && (
        <>
          {isLocked && (
            <div className="flex items-center gap-2 text-sm bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-md p-3">
              <Lock className="h-4 w-4 shrink-0" />
              <span>Attendance has been submitted and locked. Contact an admin to unlock.</span>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="py-3 px-4 text-center">
                <p className="text-2xl font-bold text-green-600">{presentCount}</p>
                <p className="text-xs text-muted-foreground">Present</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4 text-center">
                <p className="text-2xl font-bold text-red-600">{absentCount}</p>
                <p className="text-xs text-muted-foreground">Absent</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4 text-center">
                <p className="text-2xl font-bold text-amber-600">{lateCount}</p>
                <p className="text-xs text-muted-foreground">Late</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{excusedCount}</p>
                <p className="text-xs text-muted-foreground">Excused</p>
              </CardContent>
            </Card>
          </div>

          {/* Student List */}
          {records.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No enrolled students for this session.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Student Roster ({records.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {records.map((record) => {
                    const currentStatus = localStatuses[record.enrollmentId] ?? record.status;
                    return (
                      <div
                        key={record.id}
                        className="flex items-center justify-between py-3 gap-4"
                      >
                        <div>
                          <p className="font-medium text-sm">
                            {record.enrollment.student.firstName}{" "}
                            {record.enrollment.student.lastName}
                          </p>
                          {record.enrollment.student.email && (
                            <p className="text-xs text-muted-foreground">
                              {record.enrollment.student.email}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {(
                            ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const
                          ).map((status) => {
                            const config = statusConfig[status];
                            const Icon = config.icon;
                            const isActive = currentStatus === status;
                            return (
                              <button
                                key={status}
                                onClick={() => setStatus(record.enrollmentId, status)}
                                disabled={isLocked}
                                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                                  isActive
                                    ? `${config.bg} ${config.color}`
                                    : "text-muted-foreground hover:bg-muted"
                                } ${isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                title={status}
                              >
                                <Icon className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{status}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          {records.length > 0 && !isLocked && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={saveAttendance} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Draft
              </Button>
              <Button onClick={submitAndLock} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Lock className="h-4 w-4 mr-2" />
                Submit &amp; Lock
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
