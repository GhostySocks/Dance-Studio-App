"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Unlock, Loader2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StyledSelect } from "@/components/styled-select";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

interface AttendanceRecord {
  id: string;
  status: string;
  lockedAt: string | null;
  enrollment: {
    student: {
      id: string;
      firstName: string;
      lastName: string;
    };
  };
  session: {
    id: string;
    startTime: string;
    template: { name: string; danceStyle: string | null };
    teacher: { user: { name: string | null } } | null;
  };
}

interface Summary {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number;
}

interface Teacher {
  id: string;
  user: { name: string | null; email: string };
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "PRESENT":
      return "default";
    case "LATE":
      return "secondary";
    case "ABSENT":
      return "destructive";
    case "EXCUSED":
      return "outline";
    default:
      return "outline";
  }
}

export default function AdminAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");

  const [unlocking, setUnlocking] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTeachers() {
      try {
        const res = await fetch("/api/teachers?perPage=100");
        if (res.ok) {
          const json = await res.json();
          setTeachers(json.data.teachers);
        }
      } catch {
        // silent
      }
    }
    fetchTeachers();
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", new Date(startDate).toISOString());
      if (endDate) params.set("endDate", new Date(endDate).toISOString());
      if (teacherFilter) params.set("teacherId", teacherFilter);

      const res = await fetch(`/api/attendance/report?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setRecords(json.data.records);
      setSummary(json.data.summary);
    } catch {
      toast.error("Failed to load attendance report");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, teacherFilter]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  async function unlockSession(sessionId: string) {
    setUnlocking(sessionId);
    try {
      const res = await fetch("/api/attendance/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Attendance unlocked");
      fetchReport();
    } catch {
      toast.error("Failed to unlock attendance");
    } finally {
      setUnlocking(null);
    }
  }

  const columns: ColumnDef<AttendanceRecord>[] = useMemo(
    () => [
      {
        accessorKey: "student",
        header: "Student",
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.enrollment.student.firstName}{" "}
            {row.original.enrollment.student.lastName}
          </span>
        ),
      },
      {
        accessorKey: "class",
        header: "Class",
        cell: ({ row }) => row.original.session.template.name,
      },
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => {
          const d = new Date(row.original.session.startTime);
          return d.toLocaleDateString();
        },
      },
      {
        accessorKey: "teacher",
        header: "Teacher",
        cell: ({ row }) =>
          row.original.session.teacher?.user.name || "-",
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
        accessorKey: "locked",
        header: "Locked",
        cell: ({ row }) =>
          row.original.lockedAt ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Locked</Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => unlockSession(row.original.session.id)}
                disabled={unlocking === row.original.session.id}
                title="Unlock"
              >
                {unlocking === row.original.session.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlock className="h-4 w-4" />
                )}
              </Button>
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">Open</span>
          ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unlocking]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Reports"
        description="View attendance records and unlock submitted sessions"
      />

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-1">
              <Label htmlFor="startDate" className="text-xs">Start Date</Label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex h-9 rounded-full border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="endDate" className="text-xs">End Date</Label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex h-9 rounded-full border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="teacherFilter" className="text-xs">Teacher</Label>
              <StyledSelect
                value={teacherFilter}
                onChange={(val) => setTeacherFilter(val)}
                options={[
                  { value: "", label: "All Teachers" },
                  ...teachers.map((t) => ({ value: t.id, label: t.user.name || t.user.email })),
                ]}
                placeholder="All Teachers"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card>
            <CardContent className="py-3 px-4 text-center">
              <p className="text-2xl font-bold">{summary.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4 text-center">
              <p className="text-2xl font-bold text-green-600">{summary.present}</p>
              <p className="text-xs text-muted-foreground">Present</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4 text-center">
              <p className="text-2xl font-bold text-red-600">{summary.absent}</p>
              <p className="text-xs text-muted-foreground">Absent</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{summary.late}</p>
              <p className="text-xs text-muted-foreground">Late</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{summary.excused}</p>
              <p className="text-xs text-muted-foreground">Excused</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4 text-center">
              <p className="text-2xl font-bold">{summary.attendanceRate}%</p>
              <p className="text-xs text-muted-foreground">Attendance Rate</p>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card className="rounded-2xl border-0 shadow-md">
          <CardContent className="pt-6">
            <DataTable
              columns={columns}
              data={records}
              pageCount={1}
              page={1}
              onPageChange={() => {}}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
