"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Clock, MapPin, Users } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Session {
  id: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  template: { name: string; danceStyle: string };
  room: { name: string };
  /** Set when this teacher is covering the date for someone else */
  substituteFor: { user: { name: string | null } } | null;
  enrollments: {
    id: string;
    status: "ACTIVE" | "WAITLIST";
    /** Set when the student is in this class as a makeup for one they missed */
    makeupForId: string | null;
    student: { firstName: string; lastName: string };
  }[];
}

interface TeacherData {
  id: string;
  user: {
    name: string | null;
  };
  sessions: Session[];
}

export default function TeacherClassesPage() {
  const [teacher, setTeacher] = useState<TeacherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchClasses() {
      try {
        const res = await fetch("/api/teachers/me");
        if (!res.ok) {
          if (res.status === 404) {
            setError("No teacher profile found for your account.");
          } else {
            setError("Failed to load your classes.");
          }
          return;
        }
        const json = await res.json();
        setTeacher(json.data);
      } catch {
        setError("Failed to load your classes.");
      } finally {
        setLoading(false);
      }
    }
    fetchClasses();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading your classes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Classes" />
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  const sessions = teacher?.sessions ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Classes"
        description="Your upcoming classes and who is in each one"
      />

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              You have no upcoming classes scheduled.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => {
            const enrolled = session.enrollments.filter((e) => e.status === "ACTIVE");
            const waitlisted = session.enrollments.filter((e) => e.status === "WAITLIST");
            return (
            <Card key={session.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle>{session.template.name}</CardTitle>
                  <Badge variant="secondary">
                    {session.template.danceStyle}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {session.substituteFor && (
                    <p>
                      <Badge variant="outline">
                        Covering for {session.substituteFor.user.name ?? "another teacher"}
                      </Badge>
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>{formatDateTime(session.startTime)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>{session.room.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4 shrink-0" />
                    <span>
                      {enrolled.length} / {session.maxCapacity} students enrolled
                      {waitlisted.length > 0 ? `, ${waitlisted.length} waitlisted` : ""}
                    </span>
                  </div>
                </div>

                {session.enrollments.length === 0 ? (
                  <p className="mt-4 border-t pt-3 text-sm text-muted-foreground">
                    No students enrolled yet.
                  </p>
                ) : (
                  <details className="group mt-4 border-t pt-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between rounded-md text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                      <span>
                        <span className="group-open:hidden">Show students</span>
                        <span className="hidden group-open:inline">Hide students</span>
                      </span>
                      <ChevronDown
                        className="h-4 w-4 transition-transform group-open:rotate-180"
                        aria-hidden
                      />
                    </summary>
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {[...enrolled, ...waitlisted].map((enrollment) => (
                        <li key={enrollment.id} className="flex flex-wrap items-center gap-2">
                          <span>
                            {enrollment.student.firstName} {enrollment.student.lastName}
                          </span>
                          {enrollment.makeupForId && <Badge variant="secondary">Makeup</Badge>}
                          {enrollment.status === "WAITLIST" && <Badge variant="outline">Waitlist</Badge>}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
