"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Plus, Loader2, X, UserPlus, AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StyledSelect } from "@/components/styled-select";

interface EnrollmentRow {
  id: string;
  status: string;
  createdAt: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
  };
  session: {
    id: string;
    startTime: string;
    endTime: string;
    maxCapacity: number;
    template: { name: string; danceStyle: string | null; basePriceCents: number };
    teacher: { user: { name: string | null } } | null;
    room: { name: string } | null;
  };
}

interface ClassSession {
  id: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  template: { name: string; danceStyle: string | null };
  teacher: { user: { name: string | null } } | null;
  room: { name: string } | null;
  enrollments: { id: string }[];
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
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

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ACTIVE":
      return "default";
    case "WAITLIST":
      return "secondary";
    case "CANCELLED":
      return "destructive";
    default:
      return "outline";
  }
}

export default function EnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [forceEnroll, setForceEnroll] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchEnrollments = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        perPage: "20",
      });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/enrollments?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setEnrollments(json.data.enrollments);
      setTotalPages(json.data.totalPages);
    } catch {
      toast.error("Failed to load enrollments");
    }
  }, [page, search, statusFilter]);

  const fetchSessionsAndStudents = useCallback(async () => {
    try {
      const now = new Date();
      const future = new Date();
      future.setMonth(future.getMonth() + 3);

      const [sessRes, stuRes] = await Promise.all([
        fetch(`/api/sessions?startDate=${now.toISOString()}&endDate=${future.toISOString()}`),
        fetch("/api/students?perPage=200"),
      ]);

      if (sessRes.ok) {
        const json = await sessRes.json();
        setSessions(json.data);
      }
      if (stuRes.ok) {
        const json = await stuRes.json();
        setStudents(json.data.students);
      }
    } catch {
      // Silently fail — these are for the enrollment form
    }
  }, []);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  useEffect(() => {
    fetchSessionsAndStudents();
  }, [fetchSessionsAndStudents]);

  function openEnrollDialog() {
    setSelectedSessionId("");
    setSelectedStudentIds([]);
    setForceEnroll(false);
    setEnrollDialogOpen(true);
  }

  function toggleStudentSelection(studentId: string) {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  }

  async function onEnroll() {
    if (!selectedSessionId || selectedStudentIds.length === 0) {
      toast.error("Please select a session and at least one student");
      return;
    }

    setIsSubmitting(true);
    try {
      const body =
        selectedStudentIds.length === 1
          ? { studentId: selectedStudentIds[0], sessionId: selectedSessionId, force: forceEnroll }
          : { studentIds: selectedStudentIds, sessionId: selectedSessionId, force: forceEnroll };

      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Enrollment failed");
      }

      if (json.waitlist) {
        toast.info(json.message || "Student added to waitlist");
      } else {
        toast.success(json.message || "Enrollment successful");
      }

      setEnrollDialogOpen(false);
      fetchEnrollments();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Enrollment failed";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onCancel() {
    if (!cancelConfirm) return;
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/enrollments/${cancelConfirm}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error("Failed to cancel");

      if (json.promoted) {
        toast.success(json.message || "Cancelled and promoted waitlisted student");
      } else {
        toast.success("Enrollment cancelled");
      }
      setCancelConfirm(null);
      fetchEnrollments();
    } catch {
      toast.error("Failed to cancel enrollment");
    } finally {
      setIsCancelling(false);
    }
  }

  async function activateEnrollment(id: string) {
    try {
      const res = await fetch(`/api/enrollments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      if (!res.ok) throw new Error("Failed to activate");
      toast.success("Enrollment activated");
      fetchEnrollments();
    } catch {
      toast.error("Failed to activate enrollment");
    }
  }

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);
  const selectedSessionActiveCount = selectedSession?.enrollments?.length ?? 0;
  const selectedSessionFull = selectedSession
    ? selectedSessionActiveCount >= selectedSession.maxCapacity
    : false;

  const columns: ColumnDef<EnrollmentRow>[] = useMemo(
    () => [
      {
        accessorKey: "student",
        header: "Student",
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.student.firstName} {row.original.student.lastName}
          </span>
        ),
      },
      {
        accessorKey: "class",
        header: "Class",
        cell: ({ row }) => (
          <div>
            <span className="font-medium">{row.original.session.template.name}</span>
            {row.original.session.template.danceStyle && (
              <span className="text-muted-foreground ml-1 text-xs">
                ({row.original.session.template.danceStyle})
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "session",
        header: "Session Time",
        cell: ({ row }) => {
          const start = new Date(row.original.session.startTime);
          return (
            <span className="text-sm">
              {start.toLocaleDateString()} {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          );
        },
      },
      {
        accessorKey: "teacher",
        header: "Teacher",
        cell: ({ row }) => (
          <span>{row.original.session.teacher?.user.name || "-"}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={statusVariant(row.original.status)}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const enrollment = row.original;
          return (
            <div className="flex items-center gap-1">
              {enrollment.status === "WAITLIST" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => activateEnrollment(enrollment.id)}
                  title="Activate"
                >
                  <UserPlus className="h-4 w-4 text-green-600" />
                </Button>
              )}
              {enrollment.status !== "CANCELLED" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCancelConfirm(enrollment.id)}
                  title="Cancel"
                >
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div>
      <PageHeader title="Enrollments" description="Manage class enrollments and waitlists">
        <Button onClick={openEnrollDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Enroll Student
        </Button>
      </PageHeader>

      <div className="flex items-center gap-4 mb-4">
        <SearchInput
          value={search}
          onChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          placeholder="Search by student name..."
        />
        <StyledSelect
          value={statusFilter}
          onChange={(val) => {
            setStatusFilter(val);
            setPage(1);
          }}
          options={[
            { value: "", label: "All Statuses" },
            { value: "ACTIVE", label: "Active" },
            { value: "WAITLIST", label: "Waitlist" },
            { value: "CANCELLED", label: "Cancelled" },
          ]}
          placeholder="All Statuses"
        />
      </div>

      <Card className="rounded-2xl border-0 shadow-md">
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={enrollments}
            pageCount={totalPages}
            page={page}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      {/* Enroll Student Modal */}
      <Modal
        open={enrollDialogOpen}
        onClose={() => setEnrollDialogOpen(false)}
        title="Enroll Student"
        description="Select a class session and students to enroll."
        className="max-w-2xl"
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="sessionSelect">Class Session</Label>
            <StyledSelect
              value={selectedSessionId}
              onChange={(val) => setSelectedSessionId(val)}
              options={[
                { value: "", label: "Select a session..." },
                ...sessions.map((s) => {
                  const start = new Date(s.startTime);
                  const enrolled = s.enrollments?.length ?? 0;
                  return {
                    value: s.id,
                    label: `${s.template.name} — ${start.toLocaleDateString()} ${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (${enrolled}/${s.maxCapacity})${s.teacher?.user.name ? ` — ${s.teacher.user.name}` : ""}`,
                  };
                }),
              ]}
              placeholder="Select a session..."
            />
          </div>

          {selectedSession && selectedSessionFull && (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-md p-3">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                This session is at capacity ({selectedSessionActiveCount}/
                {selectedSession.maxCapacity}). New enrollments will be waitlisted
                unless &quot;Force enroll&quot; is checked.
              </span>
            </div>
          )}

          <div className="grid gap-2">
            <Label>Students</Label>
            <div className="rounded-md border max-h-48 overflow-y-auto">
              {students.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3">No students found</p>
              ) : (
                students.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.includes(s.id)}
                      onChange={() => toggleStudentSelection(s.id)}
                      className="rounded"
                    />
                    <span className="text-sm">
                      {s.firstName} {s.lastName}
                    </span>
                  </label>
                ))
              )}
            </div>
            {selectedStudentIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedStudentIds.length} student(s) selected
              </p>
            )}
          </div>

          {selectedSessionFull && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={forceEnroll}
                onChange={(e) => setForceEnroll(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium">
                Force enroll (bypass capacity limit)
              </span>
            </label>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEnrollDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={onEnroll} disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Enroll
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Confirmation Modal */}
      <Modal
        open={!!cancelConfirm}
        onClose={() => setCancelConfirm(null)}
        title="Cancel Enrollment"
        description="Are you sure you want to cancel this enrollment? If there are waitlisted students, the next one will be automatically promoted."
        className="max-w-sm"
      >
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setCancelConfirm(null)}
            disabled={isCancelling}
          >
            Keep
          </Button>
          <Button
            variant="destructive"
            onClick={onCancel}
            disabled={isCancelling}
          >
            {isCancelling && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Cancel Enrollment
          </Button>
        </div>
      </Modal>
    </div>
  );
}
