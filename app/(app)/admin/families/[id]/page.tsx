"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Mail, Phone, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import { formatCurrency, formatDate } from "@/lib/utils";

/** One line per class, however many dates of it the student is booked into. */
function classesOf(enrollments: FamilyDetail["students"][number]["enrollments"]) {
  const byName = new Map<string, { name: string; danceStyle: string | null; count: number }>();
  for (const { session } of enrollments) {
    const entry = byName.get(session.template.name) ?? {
      name: session.template.name,
      danceStyle: session.template.danceStyle,
      count: 0,
    };
    entry.count += 1;
    byName.set(session.template.name, entry);
  }
  return Array.from(byName.values());
}

interface FamilyDetail {
  id: string;
  name: string;
  students: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
    enrollments: {
      id: string;
      status: string;
      session: {
        template: { name: string; danceStyle: string | null };
      };
    }[];
  }[];
  guardians: {
    guardian: {
      id: string;
      phone: string | null;
      user: {
        name: string | null;
        email: string;
      };
    };
  }[];
  invoices: {
    id: string;
    status: string;
    totalCents: number;
    periodStart: string;
    periodEnd: string;
    createdAt: string;
  }[];
  scholarships: {
    id: string;
    name: string;
    type: string;
    amount: number;
    status: string;
  }[];
  pricingRules: {
    id: string;
    name: string;
    type: string;
    value: number;
    description: string | null;
  }[];
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const variant =
    status === "PAID"
      ? "default"
      : status === "OVERDUE"
        ? "destructive"
        : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}

export default function FamilyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [family, setFamily] = useState<FamilyDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFamily() {
      try {
        const res = await fetch(`/api/families/${params.id}`);
        const json = await res.json();
        if (res.ok) {
          setFamily(json.data);
        } else {
          toast.error("Failed to load family details");
        }
      } catch {
        toast.error("Failed to load family details");
      } finally {
        setLoading(false);
      }
    }
    if (params.id) fetchFamily();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!family) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.push("/admin/families")}>
          <ArrowLeft data-icon="inline-start" />
          Back to Families
        </Button>
        <p className="text-muted-foreground">Family not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/admin/families")}
          className="mb-4"
        >
          <ArrowLeft data-icon="inline-start" />
          Back to Families
        </Button>
        <PageHeader title={family.name} description="Family group details" />
      </div>

      {/* Guardians */}
      <Card>
        <CardHeader>
          <CardTitle>Guardians</CardTitle>
          <CardDescription>
            Contact information for family guardians
          </CardDescription>
        </CardHeader>
        <CardContent>
          {family.guardians.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No guardians assigned to this family.
            </p>
          ) : (
            <div className="space-y-3">
              {family.guardians.map((g) => (
                <div
                  key={g.guardian.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border p-3"
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    <User className="size-4 text-muted-foreground" />
                    {g.guardian.user.name || "Unnamed"}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Mail className="size-3.5" />
                    {g.guardian.user.email}
                  </span>
                  {g.guardian.phone && (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Phone className="size-3.5" />
                      {g.guardian.phone}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Students */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Students in this Family</h2>
        {family.students.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No students in this family.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {family.students.map((student) => (
              <Card key={student.id} size="sm">
                <CardHeader>
                  <CardTitle>
                    <Link
                      href={`/admin/students/${student.id}`}
                      className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
                    >
                      {student.firstName} {student.lastName}
                    </Link>
                  </CardTitle>
                  {student.dateOfBirth && (
                    <CardDescription>
                      DOB: {formatDate(student.dateOfBirth)}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {student.enrollments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No active enrollments
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        Enrollments
                      </p>
                      {classesOf(student.enrollments).map((cls) => (
                        <div key={cls.name} className="flex items-center justify-between text-sm">
                          <span>
                            {cls.name}
                            {cls.count > 1 && (
                              <span className="text-muted-foreground"> · {cls.count} classes</span>
                            )}
                          </span>
                          {cls.danceStyle && <Badge variant="secondary">{cls.danceStyle}</Badge>}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Billing History */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Billing History</h2>
        {!family.invoices || family.invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices found.</p>
        ) : (
          <Card>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-4 font-medium">Date</th>
                      <th className="pb-2 pr-4 font-medium">Period</th>
                      <th className="pb-2 pr-4 font-medium">Total</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {family.invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b last:border-0">
                        <td className="py-2 pr-4">
                          {formatDate(invoice.createdAt)}
                        </td>
                        <td className="py-2 pr-4">
                          {formatDate(invoice.periodStart)} &ndash;{" "}
                          {formatDate(invoice.periodEnd)}
                        </td>
                        <td className="py-2 pr-4">
                          {formatCurrency(invoice.totalCents)}
                        </td>
                        <td className="py-2">
                          <InvoiceStatusBadge status={invoice.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Scholarships */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Scholarships</h2>
        {!family.scholarships || family.scholarships.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active scholarships.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {family.scholarships.map((scholarship) => (
              <Card key={scholarship.id} size="sm">
                <CardHeader>
                  <CardTitle>{scholarship.name}</CardTitle>
                  <CardDescription>
                    {scholarship.type} &mdash;{" "}
                    {scholarship.type === "PERCENTAGE"
                      ? `${scholarship.amount}%`
                      : formatCurrency(scholarship.amount)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge
                    variant={
                      scholarship.status === "ACTIVE" ? "default" : "secondary"
                    }
                  >
                    {scholarship.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Pricing Rules */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Pricing Rules</h2>
        {!family.pricingRules || family.pricingRules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No custom pricing rules for this family.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {family.pricingRules.map((rule) => (
              <Card key={rule.id} size="sm">
                <CardHeader>
                  <CardTitle>{rule.name}</CardTitle>
                  {rule.description && (
                    <CardDescription>{rule.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Type:</span>{" "}
                    {rule.type} &mdash;{" "}
                    <span className="text-muted-foreground">Value:</span>{" "}
                    {rule.type === "PERCENTAGE"
                      ? `${rule.value}%`
                      : formatCurrency(rule.value)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Toaster />
    </div>
  );
}
