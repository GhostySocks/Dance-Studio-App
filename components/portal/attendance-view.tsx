"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AttendancePanel } from "@/components/attendance/attendance-panel";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudentAttendance } from "@/lib/db/student-attendance";

/** Attendance and makeups for a parent's children, or for the adult student themself. */
export function AttendanceView({ description }: { description: string }) {
  const [students, setStudents] = useState<StudentAttendance[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/attendance");
      if (!res.ok) throw new Error("Failed");
      setStudents((await res.json()).data);
    } catch {
      toast.error("Failed to load attendance");
      setStudents((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" description={description} />

      {students === null ? (
        <p className="py-12 text-center text-muted-foreground">Loading...</p>
      ) : students.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">There are no students on this account yet.</p>
          </CardContent>
        </Card>
      ) : (
        students.map((entry) => (
          <Card key={entry.student.id} className="rounded-2xl border-0 shadow-md">
            {students.length > 1 && (
              <CardHeader>
                <CardTitle>
                  {entry.student.firstName} {entry.student.lastName}
                </CardTitle>
              </CardHeader>
            )}
            <CardContent className={students.length > 1 ? undefined : "pt-6"}>
              <AttendancePanel attendance={entry} onChanged={load} />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
