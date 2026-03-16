"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface StudentData {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  familyGroup: { id: string; name: string } | null;
  enrollments: {
    id: string;
    status: string;
    session: {
      startTime: string;
      endTime: string;
      template: { name: string; danceStyle: string | null };
      teacher: { user: { name: string | null } } | null;
      room: { name: string } | null;
    };
  }[];
}

export default function ParentStudentsPage() {
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStudents() {
      try {
        const res = await fetch("/api/parent/students");
        if (!res.ok) throw new Error("Failed");
        const json = await res.json();
        setStudents(json.data || []);
      } catch {
        toast.error("Failed to load students");
      } finally {
        setLoading(false);
      }
    }
    fetchStudents();
  }, []);

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
        title="My Students"
        description="View your children and their class enrollments"
      />

      {students.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No students linked to your account.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {students.map((student) => (
            <Card key={student.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {student.firstName} {student.lastName}
                  </CardTitle>
                  {student.familyGroup && (
                    <Badge variant="secondary">{student.familyGroup.name}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {student.enrollments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active enrollments.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Active Classes ({student.enrollments.length})
                    </p>
                    <div className="divide-y">
                      {student.enrollments.map((enrollment) => {
                        const start = new Date(enrollment.session.startTime);
                        return (
                          <div key={enrollment.id} className="py-2 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">
                                {enrollment.session.template.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {enrollment.session.teacher?.user.name || "TBD"} &middot;{" "}
                                {enrollment.session.room?.name || "TBD"} &middot;{" "}
                                {start.toLocaleDateString()}{" "}
                                {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            {enrollment.session.template.danceStyle && (
                              <Badge variant="outline">
                                {enrollment.session.template.danceStyle}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
