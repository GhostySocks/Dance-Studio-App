"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { StyledSelect } from "@/components/styled-select";

type ReportType = "revenue" | "enrollment" | "utilization";

interface RoomStat {
  id: string;
  name: string;
  capacity: number;
  totalSessions: number;
  totalHours: number;
  avgOccupancy: number;
}

interface RevenueInvoice {
  id: string;
  status: string;
  totalCents: number;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  student: { firstName: string; lastName: string } | null;
  familyGroup: { name: string } | null;
}

interface EnrollmentRow {
  id: string;
  status: string;
  createdAt: string;
  student: { firstName: string; lastName: string };
  session: {
    template: { name: string; danceStyle: string | null; basePriceCents: number };
    teacher: { user: { name: string } } | null;
  };
}

type ReportData =
  | {
      type: "revenue";
      invoices: RevenueInvoice[];
      summary: {
        totalRevenue: number;
        totalTuition: number;
        totalDiscounts: number;
        totalScholarships: number;
        invoiceCount: number;
      };
    }
  | {
      type: "enrollment";
      enrollments: EnrollmentRow[];
      summary: { total: number; active: number; waitlist: number; cancelled: number };
    }
  | { type: "utilization"; rooms: RoomStat[] };

function exportCSV(data: Record<string, string | number>[], filename: string) {
  if (data.length === 0) {
    toast.error("No data to export");
    return;
  }
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (typeof val === "string" && (val.includes(",") || val.includes('"'))) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val ?? "";
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("revenue");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);

  const [reportData, setReportData] = useState<ReportData | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: reportType });
      if (startDate) params.set("startDate", new Date(startDate).toISOString());
      if (endDate) params.set("endDate", new Date(endDate).toISOString());

      const res = await fetch(`/api/admin/reports?${params}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setReportData(json.data);
    } catch {
      toast.error("Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [reportType, startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  function handleExport() {
    if (!reportData) return;

    switch (reportData.type) {
      case "revenue": {
        const rows = reportData.invoices.map((inv) => ({
          ID: inv.id,
          "Bill To": inv.familyGroup?.name || (inv.student ? `${inv.student.firstName} ${inv.student.lastName}` : "-"),
          Status: inv.status,
          "Total ($)": (inv.totalCents / 100).toFixed(2),
          "Period Start": new Date(inv.periodStart).toLocaleDateString(),
          "Period End": new Date(inv.periodEnd).toLocaleDateString(),
          "Created": new Date(inv.createdAt).toLocaleDateString(),
        }));
        exportCSV(rows, `revenue-report-${new Date().toISOString().split("T")[0]}`);
        break;
      }
      case "enrollment": {
        const rows = reportData.enrollments.map((e) => ({
          Student: `${e.student.firstName} ${e.student.lastName}`,
          Class: e.session.template.name,
          Style: e.session.template.danceStyle || "-",
          Teacher: e.session.teacher?.user?.name || "-",
          Status: e.status,
          "Price ($)": (e.session.template.basePriceCents / 100).toFixed(2),
          "Enrolled Date": new Date(e.createdAt).toLocaleDateString(),
        }));
        exportCSV(rows, `enrollment-report-${new Date().toISOString().split("T")[0]}`);
        break;
      }
      case "utilization": {
        const rows = reportData.rooms.map((r) => ({
          Room: r.name,
          Capacity: r.capacity,
          "Total Sessions": r.totalSessions,
          "Total Hours": r.totalHours,
          "Avg Occupancy (%)": r.avgOccupancy,
        }));
        exportCSV(rows, `utilization-report-${new Date().toISOString().split("T")[0]}`);
        break;
      }
    }
    toast.success("Report exported");
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Generate financial and operational reports">
        <Button onClick={handleExport} disabled={loading || !reportData}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </PageHeader>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-1">
              <Label className="text-xs">Report Type</Label>
              <StyledSelect
                value={reportType}
                onChange={(val) => setReportType(val as ReportType)}
                options={[
                  { value: "revenue", label: "Revenue (P&L)" },
                  { value: "enrollment", label: "Enrollments" },
                  { value: "utilization", label: "Room Utilization" },
                ]}
                placeholder="Select report type"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="report-start" className="text-xs">Start Date</Label>
              <input
                id="report-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex h-9 rounded-full border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="report-end" className="text-xs">End Date</Label>
              <input
                id="report-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex h-9 rounded-full border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Revenue Report */}
      {!loading && reportData?.type === "revenue" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(reportData.summary?.totalRevenue ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold">
                  {formatCurrency(reportData.summary?.totalTuition ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">Gross Tuition</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold text-amber-600">
                  {formatCurrency(reportData.summary?.totalDiscounts ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">Discounts Given</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(reportData.summary?.totalScholarships ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">Scholarships Applied</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Paid Invoices ({reportData.summary?.invoiceCount ?? 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {reportData.invoices?.length > 0 ? (
                <div className="border rounded-md overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Bill To</th>
                        <th className="text-left px-3 py-2 font-medium">Period</th>
                        <th className="text-right px-3 py-2 font-medium">Amount</th>
                        <th className="text-center px-3 py-2 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.invoices.map((inv) => (
                        <tr key={inv.id} className="border-t">
                          <td className="px-3 py-2">
                            {inv.familyGroup?.name || (inv.student ? `${inv.student.firstName} ${inv.student.lastName}` : "-")}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {new Date(inv.periodStart).toLocaleDateString()} – {new Date(inv.periodEnd).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">{formatCurrency(inv.totalCents)}</td>
                          <td className="px-3 py-2 text-center text-muted-foreground">
                            {new Date(inv.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No paid invoices in this period.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Enrollment Report */}
      {!loading && reportData?.type === "enrollment" && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold">{reportData.summary?.total ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold text-green-600">{reportData.summary?.active ?? 0}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold text-amber-600">{reportData.summary?.waitlist ?? 0}</p>
                <p className="text-xs text-muted-foreground">Waitlist</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold text-red-600">{reportData.summary?.cancelled ?? 0}</p>
                <p className="text-xs text-muted-foreground">Cancelled</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Enrollments</CardTitle>
            </CardHeader>
            <CardContent>
              {reportData.enrollments?.length > 0 ? (
                <div className="border rounded-md overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Student</th>
                        <th className="text-left px-3 py-2 font-medium">Class</th>
                        <th className="text-left px-3 py-2 font-medium">Teacher</th>
                        <th className="text-center px-3 py-2 font-medium">Status</th>
                        <th className="text-center px-3 py-2 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.enrollments.map((e) => (
                        <tr key={e.id} className="border-t">
                          <td className="px-3 py-2 font-medium">{e.student.firstName} {e.student.lastName}</td>
                          <td className="px-3 py-2">{e.session.template.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{e.session.teacher?.user?.name || "-"}</td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant={e.status === "ACTIVE" ? "default" : e.status === "CANCELLED" ? "destructive" : "secondary"}>
                              {e.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-center text-muted-foreground">
                            {new Date(e.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No enrollments in this period.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Utilization Report */}
      {!loading && reportData?.type === "utilization" && (
        <>
          {reportData.rooms?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Sessions per Room</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {reportData.rooms.map((r: RoomStat) => {
                    const max = Math.max(...reportData.rooms.map((rm: RoomStat) => rm.totalSessions), 1);
                    return (
                      <div key={r.id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{r.name}</span>
                          <span className="font-medium">{r.totalSessions} sessions</span>
                        </div>
                        <div className="h-6 w-full rounded bg-muted overflow-hidden">
                          <div
                            className="h-full rounded bg-violet-500 transition-all"
                            style={{ width: `${(r.totalSessions / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Room Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              {reportData.rooms?.length > 0 ? (
                <div className="border rounded-md overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Room</th>
                        <th className="text-center px-3 py-2 font-medium">Capacity</th>
                        <th className="text-center px-3 py-2 font-medium">Sessions</th>
                        <th className="text-center px-3 py-2 font-medium">Hours</th>
                        <th className="text-center px-3 py-2 font-medium">Avg Occupancy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.rooms.map((r: RoomStat) => (
                        <tr key={r.id} className="border-t">
                          <td className="px-3 py-2 font-medium">{r.name}</td>
                          <td className="px-3 py-2 text-center">{r.capacity}</td>
                          <td className="px-3 py-2 text-center">{r.totalSessions}</td>
                          <td className="px-3 py-2 text-center">{r.totalHours}h</td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant={r.avgOccupancy > 75 ? "default" : r.avgOccupancy > 40 ? "secondary" : "outline"}>
                              {r.avgOccupancy}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No room data available.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
