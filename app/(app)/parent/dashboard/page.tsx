"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Calendar, Receipt, BookOpen } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface DashboardData {
  studentCount: number;
  activeEnrollments: number;
  upcomingClasses: number;
  unpaidInvoices: { count: number; totalCents: number };
}

export default function ParentDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const [studentsRes, invoicesRes, scheduleRes] = await Promise.all([
          fetch("/api/parent/students"),
          fetch("/api/parent/invoices"),
          fetch("/api/parent/schedule"),
        ]);

        let studentCount = 0;
        let activeEnrollments = 0;
        if (studentsRes.ok) {
          const json = await studentsRes.json();
          const students = json.data || [];
          studentCount = students.length;
          activeEnrollments = students.reduce(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (sum: number, s: any) => sum + (s.enrollments?.length || 0),
            0
          );
        }

        let unpaidCount = 0;
        let unpaidTotal = 0;
        if (invoicesRes.ok) {
          const json = await invoicesRes.json();
          const invoices = json.data || [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const unpaid = invoices.filter((inv: any) =>
            ["SENT", "OVERDUE"].includes(inv.status)
          );
          unpaidCount = unpaid.length;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          unpaidTotal = unpaid.reduce((sum: number, inv: any) => sum + inv.totalCents, 0);
        }

        let upcomingClasses = 0;
        if (scheduleRes.ok) {
          const json = await scheduleRes.json();
          upcomingClasses = (json.data || []).length;
        }

        setData({
          studentCount,
          activeEnrollments,
          upcomingClasses,
          unpaidInvoices: { count: unpaidCount, totalCents: unpaidTotal },
        });
      } catch {
        toast.error("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
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
        title="Parent Dashboard"
        description="Manage your children&apos;s enrollments, schedule, and billing."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/parent/students">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">My Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data?.studentCount ?? 0}</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/parent/students">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Classes</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data?.activeEnrollments ?? 0}</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/parent/schedule">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Upcoming Classes</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data?.upcomingClasses ?? 0}</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/parent/billing">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Unpaid Invoices</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data?.unpaidInvoices.count ?? 0}</p>
              {(data?.unpaidInvoices.totalCents ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(data!.unpaidInvoices.totalCents)} due
                </p>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
