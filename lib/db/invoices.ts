import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { generateFamilyInvoice, generateStudentInvoice } from "@/lib/billing";

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
