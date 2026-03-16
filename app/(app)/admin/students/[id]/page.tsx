"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ArrowLeft, Plus, X, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StyledSelect } from "@/components/styled-select";

interface Enrollment {
  id: string;
  status: string;
  session: {
    id: string;
    startTime: string;
    endTime: string;
    template: { name: string; danceStyle: string; basePriceCents: number };
    teacher: { user: { name: string | null } } | null;
    room: { name: string } | null;
  };
}

interface AvailableSession {
  id: string;
  startTime: string;
  maxCapacity: number;
  template: { name: string; danceStyle: string | null };
  teacher: { user: { name: string | null } } | null;
  room: { name: string } | null;
  enrollments: { id: string }[];
}

interface Invoice {
  id: string;
  status: string;
  totalCents: number;
  periodStart: string;
  periodEnd: string;
}

interface StudentDetail {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  email: string | null;
  phone: string | null;
  medicalNotes: string | null;
  notes: string | null;
  familyGroup: { id: string; name: string } | null;
  guardian: {
    id: string;
    phone: string | null;
    address: string | null;
    user: { name: string | null; email: string };
  } | null;
  enrollments: Enrollment[];
  invoices: Invoice[];
}

function enrollmentStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ACTIVE":
      return "default";
    case "COMPLETED":
      return "secondary";
    case "DROPPED":
    case "CANCELLED":
      return "destructive";
    default:
      return "outline";
  }
}

function invoiceStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "PAID":
      return "default";
    case "PENDING":
      return "secondary";
    case "OVERDUE":
      return "destructive";
    default:
      return "outline";
  }
}

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [availableSessions, setAvailableSessions] = useState<AvailableSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [enrolling, setEnrolling] = useState(false);

  const fetchStudent = useCallback(async () => {
    try {
      const res = await fetch(`/api/students/${params.id}`);
      if (!res.ok) throw new Error("Failed to fetch student");
      const json = await res.json();
      setStudent(json.data);
    } catch {
      toast.error("Failed to load student");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchStudent();
  }, [fetchStudent]);

  async function openEnrollModal() {
    setSelectedSessionId("");
    setEnrollOpen(true);
    try {
      const now = new Date();
      const future = new Date();
      future.setMonth(future.getMonth() + 3);
      const res = await fetch(
        `/api/sessions?startDate=${now.toISOString()}&endDate=${future.toISOString()}`
      );
      if (res.ok) {
        const json = await res.json();
        setAvailableSessions(json.data);
      }
    } catch {
      toast.error("Failed to load sessions");
    }
  }

  async function handleEnroll() {
    if (!selectedSessionId) return;
    setEnrolling(true);
    try {
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: params.id, sessionId: selectedSessionId }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Enrollment failed");
      }
      if (json.waitlist) {
        toast.info(json.message || "Added to waitlist");
      } else {
        toast.success(json.message || "Enrolled successfully");
      }
      setEnrollOpen(false);
      fetchStudent();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Enrollment failed";
      toast.error(message);
    } finally {
      setEnrolling(false);
    }
  }

  async function cancelEnrollment(enrollmentId: string) {
    try {
      const res = await fetch(`/api/enrollments/${enrollmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Enrollment cancelled");
      fetchStudent();
    } catch {
      toast.error("Failed to cancel enrollment");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading student...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <p className="text-muted-foreground">Student not found.</p>
        <Button variant="outline" onClick={() => router.push("/admin/students")}>
          <ArrowLeft className="size-4 mr-2" />
          Back to Students
        </Button>
      </div>
    );
  }

  const activeEnrollments = student.enrollments.filter(
    (e) => e.status === "ACTIVE"
  );
  const pastEnrollments = student.enrollments.filter(
    (e) => e.status !== "ACTIVE"
  );

  return (
    <div>
      <Toaster />

      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push("/admin/students")}
          className="mb-4"
        >
          <ArrowLeft className="size-4 mr-2" />
          Back to Students
        </Button>

        <Card className="rounded-2xl border-0 shadow-md">
          <CardHeader>
            <CardTitle>
              {student.firstName} {student.lastName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Date of Birth
                </p>
                <p className="text-sm">
                  {student.dateOfBirth
                    ? formatDate(student.dateOfBirth)
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Email</p>
                <p className="text-sm">{student.email || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Phone</p>
                <p className="text-sm">{student.phone || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Guardian</p>
                <p className="text-sm">
                  {student.guardian
                    ? student.guardian.user.name || student.guardian.user.email
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Family Group
                </p>
                <p className="text-sm">
                  {student.familyGroup ? (
                    <Badge variant="secondary">
                      {student.familyGroup.name}
                    </Badge>
                  ) : (
                    "-"
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Active Classes
                </p>
                <p className="text-sm">{activeEnrollments.length}</p>
              </div>
              {student.medicalNotes && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    Medical Notes
                  </p>
                  <p className="text-sm">{student.medicalNotes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Tabs defaultValue="enrollments" className="flex flex-col">
          <TabsList className="bg-white rounded-full shadow-sm p-1 h-auto gap-1 self-start">
            <TabsTrigger value="enrollments" className="rounded-full px-4 py-2 text-sm data-[active]:bg-primary data-[active]:text-primary-foreground">Enrollments</TabsTrigger>
            <TabsTrigger value="history" className="rounded-full px-4 py-2 text-sm data-[active]:bg-primary data-[active]:text-primary-foreground">History</TabsTrigger>
          </TabsList>

          <TabsContent value="enrollments" className="mt-4">
          <Card className="rounded-2xl border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Active Enrollments</CardTitle>
              <Button size="sm" className="rounded-xl" onClick={openEnrollModal}>
                <Plus className="h-4 w-4 mr-1" />
                Enroll in Class
              </Button>
            </CardHeader>
            <CardContent>
              {activeEnrollments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No active enrollments.
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Class</TableHead>
                        <TableHead>Dance Style</TableHead>
                        <TableHead>Teacher</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeEnrollments.map((enrollment) => (
                        <TableRow key={enrollment.id}>
                          <TableCell className="font-medium">
                            {enrollment.session.template.name}
                          </TableCell>
                          <TableCell>
                            {enrollment.session.template.danceStyle}
                          </TableCell>
                          <TableCell>
                            {enrollment.session.teacher?.user.name || "-"}
                          </TableCell>
                          <TableCell>
                            {enrollment.session.room?.name || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={enrollmentStatusVariant(
                                enrollment.status
                              )}
                            >
                              {enrollment.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cancelEnrollment(enrollment.id)}
                              title="Cancel enrollment"
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {pastEnrollments.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium mb-3">
                    Past Enrollments
                  </h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Class</TableHead>
                          <TableHead>Dance Style</TableHead>
                          <TableHead>Teacher</TableHead>
                          <TableHead>Room</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pastEnrollments.map((enrollment) => (
                          <TableRow key={enrollment.id}>
                            <TableCell className="font-medium">
                              {enrollment.session.template.name}
                            </TableCell>
                            <TableCell>
                              {enrollment.session.template.danceStyle}
                            </TableCell>
                            <TableCell>
                              {enrollment.session.teacher?.user.name || "-"}
                            </TableCell>
                            <TableCell>
                              {enrollment.session.room?.name || "-"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={enrollmentStatusVariant(
                                  enrollment.status
                                )}
                              >
                                {enrollment.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card className="rounded-2xl border-0 shadow-md">
            <CardHeader>
              <CardTitle>Recent Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {student.invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No invoices found.
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Period Start</TableHead>
                        <TableHead>Period End</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {student.invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell>
                            <Badge
                              variant={invoiceStatusVariant(invoice.status)}
                            >
                              {invoice.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(invoice.totalCents)}
                          </TableCell>
                          <TableCell>
                            {formatDate(invoice.periodStart)}
                          </TableCell>
                          <TableCell>
                            {formatDate(invoice.periodEnd)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        </Tabs>
      </div>

      {/* Enroll Modal */}
      {enrollOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setEnrollOpen(false)} />
          <div className="relative z-50 w-full max-w-lg rounded-xl bg-background p-6 shadow-lg">
            <button
              onClick={() => setEnrollOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-semibold mb-1">Enroll in Class</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Select a class session to enroll {student.firstName} in.
            </p>
            <div className="grid gap-4">
              <StyledSelect
                value={selectedSessionId}
                onChange={(value) => setSelectedSessionId(value)}
                placeholder="Select a session..."
                options={availableSessions.map((s) => {
                  const start = new Date(s.startTime);
                  const enrolled = s.enrollments?.length ?? 0;
                  return {
                    value: s.id,
                    label: `${s.template.name} — ${start.toLocaleDateString()} ${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (${enrolled}/${s.maxCapacity})`,
                  };
                })}
              />
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setEnrollOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEnroll} disabled={enrolling || !selectedSessionId}>
                  {enrolling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Enroll
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
