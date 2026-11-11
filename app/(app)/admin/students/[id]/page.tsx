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
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Modal } from "@/components/modal";
import { AdminEnrollForm } from "@/components/forms/admin-enroll-form";
import { PLAN_LABELS, PLAN_UNITS, type BillingPlan } from "@/lib/registration-billing";

interface Enrollment {
  id: string;
  status: string;
  /** Set when the date was booked as part of a term registration. */
  registrationId: string | null;
  session: {
    id: string;
    startTime: string;
    endTime: string;
    template: { name: string; danceStyle: string; basePriceCents: number };
    teacher: { user: { name: string | null } } | null;
    room: { name: string } | null;
  };
}

interface Registration {
  id: string;
  plan: BillingPlan;
  priceCents: number;
  status: "ACTIVE" | "CANCELLED";
  createdAt: string;
  template: { name: string };
  term: { name: string } | null;
  season: { name: string } | null;
  enrollments: { status: string; session: { startTime: string } }[];
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
  registrations: Registration[];
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
  const [cancellingRegistration, setCancellingRegistration] = useState<Registration | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

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

  async function cancelRegistration() {
    if (!cancellingRegistration) return;
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/registrations/${cancellingRegistration.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(typeof json?.error === "string" ? json.error : "Could not cancel");
      } else {
        const released: number = json.data.released;
        toast.success(
          `Registration cancelled. ${released} upcoming class${released === 1 ? "" : "es"} released.`
        );
        fetchStudent();
      }
      setCancellingRegistration(null);
    } catch {
      toast.error("Could not cancel. Please try again.");
    } finally {
      setIsCancelling(false);
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

  // Dates booked through a term registration are summarised under that registration
  const activeRegistrations = student.registrations.filter((r) => r.status === "ACTIVE");
  const activeEnrollments = student.enrollments.filter(
    (e) => e.status === "ACTIVE" && !e.registrationId
  );
  const pastEnrollments = student.enrollments.filter(
    (e) => e.status !== "ACTIVE" && !e.registrationId
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
              <Button size="sm" className="rounded-xl" onClick={() => setEnrollOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Enroll in Class
              </Button>
            </CardHeader>
            <CardContent>
              {activeRegistrations.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-3">Term registrations</h3>
                  <ul className="divide-y rounded-md border">
                    {activeRegistrations.map((registration) => {
                      const held = registration.enrollments.filter((e) => e.status === "ACTIVE");
                      const waitlisted = registration.enrollments.filter((e) => e.status === "WAITLIST").length;
                      const upcoming = held.filter((e) => new Date(e.session.startTime) > new Date()).length;
                      return (
                        <li
                          key={registration.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-semibold">
                              {registration.template.name}
                              <span className="font-normal text-muted-foreground">
                                {" "}
                                · {registration.season?.name ?? registration.term?.name ?? "Term"}
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {PLAN_LABELS[registration.plan]} · {formatCurrency(registration.priceCents)}{" "}
                              {PLAN_UNITS[registration.plan]} · {held.length} class
                              {held.length === 1 ? "" : "es"} ({upcoming} still to come)
                              {waitlisted > 0 ? ` · ${waitlisted} waitlisted` : ""}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCancellingRegistration(registration)}
                          >
                            Cancel
                            <span className="sr-only"> {registration.template.name} registration</span>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {activeRegistrations.length > 0 && activeEnrollments.length > 0 && (
                <h3 className="text-sm font-medium mb-3">Single classes</h3>
              )}

              {activeEnrollments.length === 0 ? (
                activeRegistrations.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No active enrollments.
                  </p>
                )
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Class</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Teacher</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeEnrollments.map((enrollment) => (
                        <TableRow key={enrollment.id}>
                          <TableCell className="font-medium">
                            {enrollment.session.template.name}
                          </TableCell>
                          <TableCell>{formatDateTime(enrollment.session.startTime)}</TableCell>
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
                              aria-label={`Cancel ${enrollment.session.template.name} on ${formatDateTime(enrollment.session.startTime)}`}
                            >
                              <X className="h-4 w-4 text-destructive" aria-hidden />
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
      <Modal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        title={`Enroll ${student.firstName}`}
        description="Pick the class first, then the whole term or a single date."
        className="max-w-xl overflow-visible"
      >
        <AdminEnrollForm
          studentId={student.id}
          studentName={student.firstName}
          onCancel={() => setEnrollOpen(false)}
          onDone={() => {
            setEnrollOpen(false);
            fetchStudent();
          }}
        />
      </Modal>

      <Modal
        open={!!cancellingRegistration}
        onClose={() => setCancellingRegistration(null)}
        title="Cancel registration?"
        description={
          cancellingRegistration
            ? `${student.firstName} will be removed from the remaining ${cancellingRegistration.template.name} dates and will not be charged further instalments. Anything already invoiced stays as it is.`
            : undefined
        }
        className="max-w-md"
      >
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => setCancellingRegistration(null)} disabled={isCancelling}>
            Keep
          </Button>
          <Button variant="destructive" onClick={cancelRegistration} disabled={isCancelling}>
            {isCancelling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Cancel registration
          </Button>
        </div>
      </Modal>
    </div>
  );
}
