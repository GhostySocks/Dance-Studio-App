"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { BookOpen, Calendar, ClipboardCheck, Clock, MapPin, Users } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils";
import { staggerContainer } from "@/lib/motion";

interface UpcomingSession {
  id: string;
  startTime: string;
  maxCapacity: number;
  template: { name: string; danceStyle: string | null };
  room: { name: string };
  enrollments: { id: string }[];
}

interface TeacherData {
  user: { name: string | null };
  sessions: UpcomingSession[];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function TeacherDashboardPage() {
  const [teacher, setTeacher] = useState<TeacherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    async function fetchTeacher() {
      try {
        const res = await fetch("/api/teachers/me");
        if (!res.ok) {
          setError(
            res.status === 404
              ? "No teacher profile found for your account."
              : "Failed to load your dashboard."
          );
          return;
        }
        const json = await res.json();
        setTeacher(json.data);
      } catch {
        setError("Failed to load your dashboard.");
      } finally {
        setLoading(false);
      }
    }
    fetchTeacher();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Teacher Dashboard" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (error || !teacher) {
    return (
      <div className="space-y-6">
        <PageHeader title="Teacher Dashboard" />
        <p className="text-muted-foreground">{error ?? "Failed to load your dashboard."}</p>
      </div>
    );
  }

  const sessions = teacher.sessions;
  const weekFromNow = Date.now() + WEEK_MS;
  const thisWeek = sessions.filter((s) => new Date(s.startTime).getTime() <= weekFromNow);
  const studentsThisWeek = thisWeek.reduce((sum, s) => sum + s.enrollments.length, 0);
  const next = sessions[0];
  const firstName = teacher.user.name?.split(" ")[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Teacher Dashboard"}
        description="Your upcoming classes and attendance"
      />

      <motion.div
        className="grid gap-4 sm:grid-cols-3"
        variants={staggerContainer}
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
      >
        <StatCard
          title="Classes This Week"
          value={thisWeek.length}
          subtitle={`${sessions.length} upcoming in total`}
          icon={Calendar}
          domain="schedule"
        />
        <StatCard
          title="Students This Week"
          value={studentsThisWeek}
          subtitle="Enrolled across this week's classes"
          icon={Users}
          domain="people"
        />
        <StatCard
          title="Next Class"
          value={next ? next.template.name : "None"}
          subtitle={next ? formatDateTime(next.startTime) : "Nothing scheduled"}
          icon={BookOpen}
          domain="classes"
        />
      </motion.div>

      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Coming up</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/teacher/classes" />}>
              All classes
            </Button>
            <Button size="sm" nativeButton={false} render={<Link href="/teacher/attendance" />}>
              <ClipboardCheck className="h-4 w-4 mr-1" />
              Take attendance
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              You have no upcoming classes scheduled.
            </p>
          ) : (
            <div className="divide-y">
              {sessions.slice(0, 6).map((session) => (
                <div
                  key={session.id}
                  className="py-3 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{session.template.name}</p>
                      {session.template.danceStyle && (
                        <Badge variant="secondary">{session.template.danceStyle}</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDateTime(session.startTime)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {session.room.name}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {session.enrollments.length} / {session.maxCapacity} enrolled
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
