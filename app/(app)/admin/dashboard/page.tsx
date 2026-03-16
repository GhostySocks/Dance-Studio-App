"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "motion/react";
import {
  Users,
  UserCircle,
  GraduationCap,
  BookOpen,
  Calendar,
  DoorOpen,
  DollarSign,
  Clock,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { staggerContainer } from "@/lib/motion";

interface Overview {
  totalStudents: number;
  totalFamilies: number;
  totalTeachers: number;
  activeEnrollments: number;
  waitlistCount: number;
  totalRooms: number;
  upcomingSessions: number;
  revenueThisMonth: number;
}

interface RecentEnrollment {
  id: string;
  createdAt: string;
  student: { firstName: string; lastName: string };
  session: { template: { name: string } };
}

interface ChartData {
  monthlyRevenue: { month: string; total: number }[];
  enrollmentsByStyle: { style: string; count: number }[];
  roomUtilization: { name: string; sessions: number; capacity: number }[];
}

const BAR_COLORS = [
  "bg-domain-classes", "bg-domain-people", "bg-domain-money",
  "bg-domain-schedule", "bg-domain-alert",
];

const DOT_COLORS = [
  "hsl(270 55% 90%)", "hsl(135 60% 88%)", "hsl(52 80% 85%)",
  "hsl(210 60% 90%)", "hsl(340 60% 90%)",
];

export default function AdminDashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [recentEnrollments, setRecentEnrollments] = useState<RecentEnrollment[]>([]);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/admin/stats");
        if (!res.ok) throw new Error("Failed");
        const json = await res.json();
        setOverview(json.data.overview);
        setRecentEnrollments(json.data.recentEnrollments);
        setCharts(json.data.charts);
      } catch {
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Overview of your dance studio" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const revenueMax = Math.max(...(charts?.monthlyRevenue?.map((r) => r.total) ?? [0]), 1);
  const roomMax = Math.max(...(charts?.roomUtilization?.map((r) => r.sessions) ?? [0]), 1);
  const styleTotal = charts?.enrollmentsByStyle?.reduce((s, e) => s + e.count, 0) ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Overview of your dance studio" />

      {/* Top Stat Cards */}
      <motion.div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <StatCard
          title="Students"
          value={overview?.totalStudents ?? 0}
          icon={Users}
          domain="people"
        />
        <StatCard
          title="Families"
          value={overview?.totalFamilies ?? 0}
          icon={UserCircle}
          domain="people"
        />
        <StatCard
          title="Teachers"
          value={overview?.totalTeachers ?? 0}
          icon={GraduationCap}
          domain="classes"
        />
        <StatCard
          title="Revenue (This Month)"
          value={formatCurrency(overview?.revenueThisMonth ?? 0)}
          icon={DollarSign}
          domain="money"
        />
      </motion.div>

      {/* Second Row Stat Cards */}
      <motion.div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <StatCard
          title="Active Enrollments"
          value={overview?.activeEnrollments ?? 0}
          subtitle={
            (overview?.waitlistCount ?? 0) > 0
              ? `${overview?.waitlistCount} on waitlist`
              : undefined
          }
          icon={BookOpen}
          domain="classes"
        />
        <StatCard
          title="Upcoming Sessions"
          value={overview?.upcomingSessions ?? 0}
          icon={Calendar}
          domain="schedule"
        />
        <StatCard
          title="Rooms"
          value={overview?.totalRooms ?? 0}
          icon={DoorOpen}
          domain="schedule"
        />
        <StatCard
          title="Waitlist"
          value={overview?.waitlistCount ?? 0}
          icon={Clock}
          domain="alert"
        />
      </motion.div>

      {/* Charts Row */}
      <motion.div
        className="grid gap-4 lg:grid-cols-2"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        {/* Monthly Revenue */}
        <Card className="rounded-2xl border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {charts?.monthlyRevenue && charts.monthlyRevenue.length > 0 ? (
              <div className="space-y-3">
                {charts.monthlyRevenue.map((item, i) => (
                  <motion.div
                    key={item.month}
                    className="space-y-1.5"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.05 }}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground font-medium">{item.month}</span>
                      <span className="font-semibold">{formatCurrency(item.total)}</span>
                    </div>
                    <div className="h-7 w-full rounded-xl bg-muted/60 overflow-hidden">
                      <motion.div
                        className="h-full rounded-xl bg-domain-money"
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.total / revenueMax) * 100}%` }}
                        transition={{ duration: 0.6, delay: 0.5 + i * 0.05, ease: "easeOut" }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No revenue data yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Enrollments by Style */}
        <Card className="rounded-2xl border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Enrollments by Dance Style</CardTitle>
          </CardHeader>
          <CardContent>
            {charts?.enrollmentsByStyle && charts.enrollmentsByStyle.length > 0 ? (
              <div className="space-y-3">
                {charts.enrollmentsByStyle.map((item, i) => (
                  <motion.div
                    key={item.style}
                    className="space-y-1.5"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.05 }}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: DOT_COLORS[i % DOT_COLORS.length] }}
                        />
                        <span className="font-medium">{item.style}</span>
                      </div>
                      <span className="font-semibold">
                        {item.count} <span className="text-muted-foreground font-normal">({Math.round((item.count / styleTotal) * 100)}%)</span>
                      </span>
                    </div>
                    <div className="h-5 w-full rounded-xl bg-muted/60 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-xl ${BAR_COLORS[i % BAR_COLORS.length]}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.count / styleTotal) * 100}%` }}
                        transition={{ duration: 0.6, delay: 0.5 + i * 0.05, ease: "easeOut" }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No enrollment data yet.
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Room Utilization & Recent Enrollments */}
      <motion.div
        className="grid gap-4 lg:grid-cols-2"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <Card className="rounded-2xl border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Room Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            {charts?.roomUtilization && charts.roomUtilization.length > 0 ? (
              <div className="space-y-3">
                {charts.roomUtilization.map((room, i) => (
                  <motion.div
                    key={room.name}
                    className="space-y-1.5"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + i * 0.05 }}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{room.name}</span>
                      <span className="text-muted-foreground">{room.sessions} sessions</span>
                    </div>
                    <div className="h-6 w-full rounded-xl bg-muted/60 overflow-hidden">
                      <motion.div
                        className="h-full rounded-xl bg-domain-schedule"
                        initial={{ width: 0 }}
                        animate={{ width: `${(room.sessions / roomMax) * 100}%` }}
                        transition={{ duration: 0.6, delay: 0.7 + i * 0.05, ease: "easeOut" }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No session data yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Recent Enrollments</CardTitle>
          </CardHeader>
          <CardContent>
            {recentEnrollments.length > 0 ? (
              <div className="divide-y">
                {recentEnrollments.map((e, i) => (
                  <motion.div
                    key={e.id}
                    className="py-3 flex items-center justify-between"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + i * 0.05 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-domain-people flex items-center justify-center text-domain-people-icon text-xs font-bold">
                        {e.student.firstName[0]}{e.student.lastName[0]}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          {e.student.firstName} {e.student.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {e.session.template.name}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleDateString()}
                    </span>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No recent enrollments.
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
