import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { generateFamilyInvoice, generateStudentInvoice } from "@/lib/billing";
import { mapWithLimit } from "@/lib/billing-period";

export async function getInvoices({
  status,
  familyGroupId,
  studentId,
  page = 1,
  perPage = 20,
}: {
  status?: string;
  familyGroupId?: string;
  studentId?: string;
  page?: number;
  perPage?: number;
}) {
  const where: Prisma.InvoiceWhereInput = {};
  if (status) where.status = status as Prisma.EnumInvoiceStatusFilter;
  if (familyGroupId) where.familyGroupId = familyGroupId;
  if (studentId) where.studentId = studentId;

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        familyGroup: { select: { id: true, name: true } },
        lineItems: true,
        payments: { select: { id: true, amountCents: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.invoice.count({ where }),
  ]);

  return { invoices, total, totalPages: Math.ceil(total / perPage) };
}

export async function getInvoiceById(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, email: true } },
      familyGroup: { select: { id: true, name: true } },
      lineItems: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function createInvoiceFromBilling({
  familyGroupId,
  studentId,
  periodStart,
  periodEnd,
}: {
  familyGroupId?: string;
  studentId?: string;
  periodStart: Date;
  periodEnd: Date;
}) {
  let billingResult;

  if (familyGroupId) {
    billingResult = await generateFamilyInvoice({
      familyGroupId,
      periodStart,
      periodEnd,
    });
  } else if (studentId) {
    billingResult = await generateStudentInvoice({
      studentId,
      periodStart,
      periodEnd,
    });
  } else {
    throw new Error("Either familyGroupId or studentId is required");
  }

  if (billingResult.enrollmentCount === 0) {
    return { invoice: null, message: "No active enrollments found for this period" };
  }

  // Set due date 30 days after period end
  const dueDate = new Date(periodEnd);
  dueDate.setDate(dueDate.getDate() + 30);

  // Created together with the record of which registration instalments it bills,
  // so an instalment can never end up on two invoices.
  const invoice = await prisma.invoice.create({
    data: {
      registrationCharges: { create: billingResult.registrationCharges },
      studentId: studentId || null,
      familyGroupId: familyGroupId || null,
      periodStart,
      periodEnd,
      dueDate,
      status: "DRAFT",
      totalCents: billingResult.totalCents,
      lineItems: {
        create: billingResult.lineItems,
      },
    },
    include: {
      lineItems: true,
      student: { select: { id: true, firstName: true, lastName: true } },
      familyGroup: { select: { id: true, name: true } },
    },
  });

  return { invoice, message: "Invoice created successfully" };
}

export interface GenerateAllResult {
  created: { id: string; billTo: string; totalCents: number }[];
  /** Total of the invoices created, in cents. */
  totalCents: number;
  /** Skipped: they already have an invoice (not void) overlapping the period. */
  alreadyInvoiced: string[];
  /** Skipped: nothing fell due in the period. */
  nothingToBill: number;
  /** Could not be generated; the others were still created. */
  failed: string[];
}

/** Invoices are generated a few at a time: the database pool is small (see lib/prisma.ts). */
const GENERATE_CONCURRENCY = 3;

/**
 * Generates a DRAFT invoice for everyone with something to pay in the period:
 * one invoice per family group covering all of its students, and one per student
 * who is not in a family group. Anyone who already has an invoice overlapping the
 * period (other than a void one) is skipped, so running it twice bills nobody twice.
 */
export async function generateAllInvoices({
  periodStart,
  periodEnd,
  actorId,
}: {
  periodStart: Date;
  periodEnd: Date;
  actorId: string;
}): Promise<GenerateAllResult> {
  const billable: Prisma.StudentWhereInput = {
    OR: [
      { enrollments: { some: { status: "ACTIVE" } } },
      { registrations: { some: { status: "ACTIVE" } } },
    ],
  };

  const [families, students, existing] = await Promise.all([
    prisma.familyGroup.findMany({
      where: { students: { some: billable } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.student.findMany({
      where: { familyGroupId: null, ...billable },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.invoice.findMany({
      where: {
        status: { not: "VOID" },
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
      select: { familyGroupId: true, studentId: true },
    }),
  ]);

  const invoicedFamilies = new Set(existing.map((i) => i.familyGroupId).filter(Boolean));
  const invoicedStudents = new Set(existing.map((i) => i.studentId).filter(Boolean));

  const targets = [
    ...families.map((f) => ({ billTo: f.name, familyGroupId: f.id, invoiced: invoicedFamilies.has(f.id) })),
    ...students.map((s) => ({
      billTo: `${s.firstName} ${s.lastName}`,
      studentId: s.id,
      invoiced: invoicedStudents.has(s.id),
    })),
  ];

  const result: GenerateAllResult = {
    created: [],
    totalCents: 0,
    alreadyInvoiced: targets.filter((t) => t.invoiced).map((t) => t.billTo),
    nothingToBill: 0,
    failed: [],
  };

  const outcomes = await mapWithLimit(
    targets.filter((t) => !t.invoiced),
    GENERATE_CONCURRENCY,
    async (target) => {
      try {
        const { invoice } = await createInvoiceFromBilling({
          familyGroupId: "familyGroupId" in target ? target.familyGroupId : undefined,
          studentId: "studentId" in target ? target.studentId : undefined,
          periodStart,
          periodEnd,
        });
        return { target, invoice };
      } catch (error) {
        console.error(`Generating the invoice for ${target.billTo} failed:`, error);
        return { target, invoice: undefined };
      }
    }
  );

  for (const { target, invoice } of outcomes) {
    if (invoice === undefined) result.failed.push(target.billTo);
    else if (invoice === null) result.nothingToBill += 1;
    else {
      result.created.push({ id: invoice.id, billTo: target.billTo, totalCents: invoice.totalCents });
      result.totalCents += invoice.totalCents;
    }
  }

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "INVOICES_GENERATED",
      entityType: "Invoice",
      entityId: "bulk",
      meta: {
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        created: result.created.length,
        totalCents: result.totalCents,
        alreadyInvoiced: result.alreadyInvoiced.length,
        nothingToBill: result.nothingToBill,
        failed: result.failed.length,
      },
    },
  });

  return result;
}

/**
 * Marks draft invoices as sent: the ones named in `ids`, or every draft when
 * `ids` is left out. Invoices that are not drafts are left alone and counted as
 * skipped, so a paid or void invoice can never be "sent" again from a stale list.
 */
export async function markDraftInvoicesSent({ ids, actorId }: { ids?: string[]; actorId: string }) {
  const drafts = await prisma.invoice.findMany({
    where: { status: "DRAFT", ...(ids ? { id: { in: ids } } : {}) },
    select: { id: true },
  });
  const sentIds = drafts.map((d) => d.id);
  const skipped = ids ? new Set(ids).size - sentIds.length : 0;
  if (sentIds.length === 0) return { sentIds, skipped };

  await prisma.$transaction([
    prisma.invoice.updateMany({
      where: { id: { in: sentIds }, status: "DRAFT" },
      data: { status: "SENT" },
    }),
    prisma.auditLog.create({
      data: {
        actorId,
        action: "INVOICES_SENT",
        entityType: "Invoice",
        entityId: "bulk",
        meta: { count: sentIds.length, skipped, all: !ids },
      },
    }),
  ]);
  return { sentIds, skipped };
}

export async function updateInvoiceStatus(
  id: string,
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "VOID"
) {
  // Validate status transitions
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!invoice) throw new Error("Invoice not found");

  const validTransitions: Record<string, string[]> = {
    DRAFT: ["SENT", "VOID"],
    SENT: ["PAID", "OVERDUE", "VOID"],
    OVERDUE: ["PAID", "VOID"],
    PAID: [],
    VOID: [],
  };

  if (!validTransitions[invoice.status]?.includes(status)) {
    throw new Error(
      `Cannot transition from ${invoice.status} to ${status}`
    );
  }

  return prisma.invoice.update({
    where: { id },
    data: { status },
  });
}

export async function deleteInvoice(id: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status !== "DRAFT") {
    throw new Error("Only DRAFT invoices can be deleted");
  }

  return prisma.invoice.delete({ where: { id } });
}

// ─── Scholarships ──────────────────────────────────────────────────────────

export async function getScholarships({
  page = 1,
  perPage = 20,
}: {
  page?: number;
  perPage?: number;
}) {
  const [scholarships, total] = await Promise.all([
    prisma.scholarship.findMany({
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        familyGroup: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.scholarship.count(),
  ]);

  return { scholarships, total, totalPages: Math.ceil(total / perPage) };
}

export async function createScholarship(data: {
  name: string;
  studentId?: string | null;
  familyGroupId?: string | null;
  type: "PERCENT" | "FIXED" | "WAIVER";
  value: number;
  startDate: Date;
  endDate?: Date | null;
  notes?: string | null;
}) {
  return prisma.scholarship.create({ data });
}

export async function updateScholarship(
  id: string,
  data: {
    name?: string;
    studentId?: string | null;
    familyGroupId?: string | null;
    type?: "PERCENT" | "FIXED" | "WAIVER";
    value?: number;
    startDate?: Date;
    endDate?: Date | null;
    notes?: string | null;
  }
) {
  return prisma.scholarship.update({ where: { id }, data });
}

export async function deleteScholarship(id: string) {
  return prisma.scholarship.delete({ where: { id } });
}

// ─── Pricing Rules ─────────────────────────────────────────────────────────

export async function getPricingRules() {
  return prisma.pricingRule.findMany({
    include: {
      familyGroup: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createPricingRule(data: {
  name: string;
  familyGroupId?: string | null;
  triggerCount: number;
  discountType: "PERCENT_OFF" | "FIXED_PRICE" | "FAMILY_CAP";
  discountValue: number;
  isGlobal?: boolean;
}) {
  return prisma.pricingRule.create({ data });
}

export async function updatePricingRule(
  id: string,
  data: {
    name?: string;
    familyGroupId?: string | null;
    triggerCount?: number;
    discountType?: "PERCENT_OFF" | "FIXED_PRICE" | "FAMILY_CAP";
    discountValue?: number;
    isGlobal?: boolean;
  }
) {
  return prisma.pricingRule.update({ where: { id }, data });
}

export async function deletePricingRule(id: string) {
  return prisma.pricingRule.delete({ where: { id } });
}
