"use client";

import { useEffect, useState } from "react";
import { Clock, MapPin, Users } from "lucide-react";
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
  enrollments: { id: string }[];
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
        description="Your upcoming scheduled classes"
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
          {sessions.map((session) => (
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
                      {session.enrollments.length} / {session.maxCapacity}{" "}
                      students enrolled
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
