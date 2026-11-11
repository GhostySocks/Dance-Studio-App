"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { AddChildForm } from "@/components/forms/add-child-form";
import { EmailTeacherButton } from "@/components/email-teacher-button";
import { withinTeacherContactWindow } from "@/lib/teacher-contact";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
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
      teacher: { id: string; user: { name: string | null } } | null;
      room: { name: string } | null;
    };
  }[];
}

/** Each current teacher of this child once, with the classes they teach them. */
function teachersOf(student: StudentData) {
  const byId = new Map<string, { id: string; name: string; classes: string[] }>();
  for (const { session } of student.enrollments) {
    // Only current classes: the server refuses older ones too
    if (!session.teacher?.user.name || !withinTeacherContactWindow(session.startTime)) continue;
    const entry = byId.get(session.teacher.id) ?? {
      id: session.teacher.id,
      name: session.teacher.user.name,
      classes: [],
    };
    if (!entry.classes.includes(session.template.name)) entry.classes.push(session.template.name);
    byId.set(session.teacher.id, entry);
  }
  return Array.from(byId.values());
}

export default function ParentStudentsPage() {
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const fetchStudents = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

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
      >
        <LinkButton href="/schedule" variant="outline">
          Enroll in a class
        </LinkButton>
        {!adding && (
          <Button onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Add a child
          </Button>
        )}
      </PageHeader>

      {adding && (
        <Card>
          <CardHeader>
            <CardTitle>Add a child</CardTitle>
          </CardHeader>
          <CardContent>
            <AddChildForm
              onCancel={() => setAdding(false)}
              onAdded={() => {
                setAdding(false);
                fetchStudents();
              }}
            />
          </CardContent>
        </Card>
      )}

      {students.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No children on your account yet. Use &ldquo;Add a child&rdquo; to get started.
            </p>
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
                    <ul className="mb-4 space-y-2">
                      {teachersOf(student).map((teacher) => (
                        <li
                          key={teacher.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2"
                        >
                          <p className="text-sm">
                            <span className="font-medium">{teacher.name}</span>
                            <span className="text-muted-foreground"> · {teacher.classes.join(", ")}</span>
                          </p>
                          <EmailTeacherButton
                            teacherId={teacher.id}
                            teacherName={teacher.name}
                            className={teacher.classes.join(" and ")}
                          />
                        </li>
                      ))}
                    </ul>
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
