"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { BookOpen, Calendar, Clock, MapPin, Receipt, User } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { staggerContainer } from "@/lib/motion";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface ScheduleEntry {
  id: string;
  session: {
    startTime: string;
    template: { name: string; danceStyle: string | null };
    teacher: { user: { name: string | null } } | null;
    room: { name: string } | null;
  };
}

interface InvoiceSummary {
  status: string;
  totalCents: number;
}

export default function StudentDashboardPage() {
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    async function load() {
      try {
        const [scheduleRes, invoicesRes] = await Promise.all([
          fetch("/api/parent/schedule"),
          fetch("/api/parent/invoices"),
        ]);
        if (!scheduleRes.ok || !invoicesRes.ok) {
          setError(true);
          return;
        }
        setSchedule((await scheduleRes.json()).data ?? []);
        setInvoices((await invoicesRes.json()).data ?? []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Dashboard" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Dashboard" />
        <p className="text-muted-foreground">Failed to load your dashboard.</p>
      </div>
    );
  }

  const next = schedule[0];
  const unpaid = invoices.filter((inv) => inv.status === "SENT" || inv.status === "OVERDUE");
  const dueCents = unpaid.reduce((sum, inv) => sum + inv.totalCents, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="My Dashboard" description="Your classes and billing">
        <Button nativeButton={false} render={<Link href="/schedule" />}>
          Enroll in a class
        </Button>
      </PageHeader>

      <motion.div
        className="grid gap-4 sm:grid-cols-3"
        variants={staggerContainer}
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
      >
        <StatCard
          title="Upcoming Classes"
          value={schedule.length}
          subtitle="Classes you are enrolled in"
          icon={Calendar}
          domain="schedule"
        />
        <StatCard
          title="Next Class"
          value={next ? next.session.template.name : "None"}
          subtitle={next ? formatDateTime(next.session.startTime) : "Nothing scheduled"}
          icon={BookOpen}
          domain="classes"
        />
        <StatCard
          title="Balance Due"
          value={formatCurrency(dueCents)}
          subtitle={
            unpaid.length === 0
              ? "You are all paid up"
              : `${unpaid.length} unpaid invoice${unpaid.length === 1 ? "" : "s"}`
          }
          icon={Receipt}
          domain="money"
        />
      </motion.div>

      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Coming up</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/student/schedule" />}>
              Full schedule
            </Button>
            {unpaid.length > 0 && (
              <Button size="sm" nativeButton={false} render={<Link href="/student/billing" />}>
                Pay invoices
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {schedule.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              You have no upcoming classes. Browse the schedule to enroll.
            </p>
          ) : (
            <div className="divide-y">
              {schedule.slice(0, 6).map((entry) => (
                <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{entry.session.template.name}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDateTime(entry.session.startTime)}
                      </span>
                      {entry.session.teacher?.user.name && (
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {entry.session.teacher.user.name}
                        </span>
                      )}
                      {entry.session.room?.name && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {entry.session.room.name}
                        </span>
                      )}
                    </div>
                  </div>
                  {entry.session.template.danceStyle && (
                    <Badge variant="secondary">{entry.session.template.danceStyle}</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
