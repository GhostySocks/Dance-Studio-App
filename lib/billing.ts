import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

import { getRegistrationsForBilling } from "@/lib/db/registrations";
import { chargesToBill, planCharges } from "@/lib/registration-billing";

interface LineItem {
  description: string;
  amountCents: number;
  type: "TUITION" | "DISCOUNT" | "SCHOLARSHIP" | "FEE";
}

/** A registration instalment placed on this invoice; recorded so it is never billed again. */
export interface BilledRegistrationCharge {
  registrationId: string;
  periodKey: string;
  amountCents: number;
}

/**
 * One thing a family is billed for in a period: a single class date booked on its
 * own, or a term registration (whose price for the period is the sum of the
 * instalments falling due). Multi-class discounts rank and discount whole units, so
 * four weekly instalments of one registration count as one enrollment, not four.
 */
interface BillableUnit {
  kind: "class" | "registration";
  studentName: string;
  className: string;
  priceCents: number;
  lines: { description: string; amountCents: number }[];
  charges: BilledRegistrationCharge[];
}

export interface BillingResult {
  lineItems: LineItem[];
  totalCents: number;
  /** Number of billable units (single classes plus registrations with something due). */
  enrollmentCount: number;
  registrationCharges: BilledRegistrationCharge[];
}

const EMPTY: BillingResult = { lineItems: [], totalCents: 0, enrollmentCount: 0, registrationCharges: [] };

/** Single class dates in the period that are not part of a term registration. */
async function classUnits(
  studentWhere: Prisma.StudentWhereInput & { id?: string },
  periodStart: Date,
  periodEnd: Date
): Promise<BillableUnit[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      status: "ACTIVE",
      registrationId: null,
      ...(studentWhere.id ? { studentId: studentWhere.id } : { student: studentWhere }),
      session: {
        startTime: { gte: periodStart },
        endTime: { lte: periodEnd },
      },
    },
    include: {
      student: { select: { firstName: true, lastName: true } },
      session: {
        include: {
          template: { select: { name: true, danceStyle: true, basePriceCents: true } },
        },
      },
    },
  });

  return enrollments.map((enrollment) => {
    const studentName = `${enrollment.student.firstName} ${enrollment.student.lastName}`;
    const className = enrollment.session.template.name;
    const priceCents = enrollment.session.template.basePriceCents;
    return {
      kind: "class",
      studentName,
      className,
      priceCents,
      lines: [{ description: `${className} — ${studentName}`, amountCents: priceCents }],
      charges: [],
    };
  });
}

/** Term registrations with at least one instalment due by the end of the period. */
async function registrationUnits(
  studentWhere: Prisma.StudentWhereInput,
  periodEnd: Date
): Promise<BillableUnit[]> {
  const registrations = await getRegistrationsForBilling(studentWhere);
  if (registrations.length === 0) return [];

  const studio = await prisma.studioProfile.findFirst({ select: { timezone: true } });
  const timeZone = studio?.timezone ?? "America/New_York";

  const units: BillableUnit[] = [];
  for (const registration of registrations) {
    const due = chargesToBill(
      planCharges({
        plan: registration.plan,
        priceCents: registration.priceCents,
        coverageName: registration.season?.name ?? registration.term?.name ?? "Term",
        registeredAt: registration.createdAt,
        sessionStarts: registration.enrollments.map((e) => e.session.startTime),
        timeZone,
      }),
      periodEnd,
      registration.charges.map((c) => c.periodKey)
    );
    if (due.length === 0) continue;

    const studentName = `${registration.student.firstName} ${registration.student.lastName}`;
    const className = registration.template.name;
    units.push({
      kind: "registration",
      studentName,
      className,
      priceCents: due.reduce((sum, c) => sum + c.amountCents, 0),
      lines: due.map((c) => ({
        description: `${className} — ${studentName} (${c.label})`,
        amountCents: c.amountCents,
      })),
      charges: due.map((c) => ({
        registrationId: registration.id,
        periodKey: c.key,
        amountCents: c.amountCents,
      })),
    });
  }
  return units;
}

type ScholarshipForBilling = { name: string; type: "PERCENT" | "FIXED" | "WAIVER"; value: number };

/** Applies scholarships as negative line items. Returns the new running total. */
function applyScholarships(
  scholarships: ScholarshipForBilling[],
  lineItems: LineItem[],
  startingTotal: number
): number {
  let runningTotal = startingTotal;
  for (const scholarship of scholarships) {
    switch (scholarship.type) {
      case "PERCENT": {
        const credit = Math.round(runningTotal * (scholarship.value / 100));
        if (credit > 0) {
          lineItems.push({
            description: `Scholarship: ${scholarship.name} (${scholarship.value}%)`,
            amountCents: -credit,
            type: "SCHOLARSHIP",
          });
          runningTotal -= credit;
        }
        break;
      }
      case "FIXED": {
        const credit = Math.min(scholarship.value, runningTotal);
        if (credit > 0) {
          lineItems.push({
            description: `Scholarship: ${scholarship.name}`,
            amountCents: -credit,
            type: "SCHOLARSHIP",
          });
          runningTotal -= credit;
        }
        break;
      }
      case "WAIVER": {
        if (runningTotal > 0) {
          lineItems.push({
            description: `Scholarship: ${scholarship.name} (Full waiver)`,
            amountCents: -runningTotal,
            type: "SCHOLARSHIP",
          });
          runningTotal = 0;
        }
        break;
      }
    }
  }
  return Math.max(0, runningTotal);
}

/**
 * Family Pricing Engine — the logic from CLAUDE.md, extended for term registrations:
 * 1. Collect what the family is billed for in the period: ACTIVE single-class
 *    enrollments, plus instalments of term registrations that have fallen due
 * 2. Sort by price descending (most expensive first)
 * 3. Apply full price to the first
 * 4. For the 2nd onward, evaluate PricingRules for this family group (or global rules)
 * 5. Rule types: PERCENT_OFF, FIXED_PRICE, FAMILY_CAP. FIXED_PRICE is a per-class
 *    price, so it applies to single-class enrollments only, never to a registration
 * 6. Apply scholarship credits as negative InvoiceLineItem records after discounts
 * 7. All amounts in cents. Round with Math.round()
 */
export async function generateFamilyInvoice({
  familyGroupId,
  periodStart,
  periodEnd,
}: {
  familyGroupId: string;
  periodStart: Date;
  periodEnd: Date;
}): Promise<BillingResult> {
  const studentWhere = { familyGroupId };
  const units = [
    ...(await classUnits(studentWhere, periodStart, periodEnd)),
    ...(await registrationUnits(studentWhere, periodEnd)),
  ];
  if (units.length === 0) return EMPTY;

  // 2. Sort by price descending
  units.sort((a, b) => b.priceCents - a.priceCents);

  // Get pricing rules (family-specific + global)
  const pricingRules = await prisma.pricingRule.findMany({
    where: {
      OR: [{ familyGroupId }, { isGlobal: true }],
    },
    orderBy: { triggerCount: "asc" },
  });

  // Get active scholarships
  const scholarships = await prisma.scholarship.findMany({
    where: {
      AND: [
        {
          OR: [{ familyGroupId }, { student: { familyGroupId } }],
        },
        { startDate: { lte: periodEnd } },
        {
          OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
        },
      ],
    },
  });

  const lineItems: LineItem[] = [];
  let runningTotal = 0;

  // 3 & 4. Apply pricing
  units.forEach((unit, i) => {
    for (const line of unit.lines) lineItems.push({ ...line, type: "TUITION" });
    runningTotal += unit.priceCents;

    // Full price for the first unit
    if (i === 0) return;

    let discountedPrice = unit.priceCents;
    for (const rule of pricingRules) {
      // Rule applies if this is the Nth+ enrollment (1-indexed, so i+1 >= triggerCount)
      if (i + 1 < rule.triggerCount) continue;
      if (rule.discountType === "PERCENT_OFF") {
        discountedPrice = Math.round(unit.priceCents * (1 - rule.discountValue / 100));
      } else if (rule.discountType === "FIXED_PRICE" && unit.kind === "class") {
        discountedPrice = rule.discountValue;
      }
      // FAMILY_CAP is handled after all tuition items
    }

    if (discountedPrice < unit.priceCents) {
      const discountAmount = unit.priceCents - discountedPrice;
      lineItems.push({
        description: `Multi-class discount — ${unit.className} — ${unit.studentName}`,
        amountCents: -discountAmount,
        type: "DISCOUNT",
      });
      runningTotal -= discountAmount;
    }
  });

  // 5. Apply FAMILY_CAP rules
  for (const rule of pricingRules) {
    if (rule.discountType === "FAMILY_CAP" && runningTotal > rule.discountValue) {
      const capDiscount = runningTotal - rule.discountValue;
      lineItems.push({
        description: `Family cap discount (max $${(rule.discountValue / 100).toFixed(2)}/period)`,
        amountCents: -capDiscount,
        type: "DISCOUNT",
      });
      runningTotal = rule.discountValue;
    }
  }

  // 6. Apply scholarships
  const totalCents = applyScholarships(scholarships, lineItems, runningTotal);

  return {
    lineItems,
    totalCents,
    enrollmentCount: units.length,
    registrationCharges: units.flatMap((u) => u.charges),
  };
}

/**
 * Generate invoice for a single student (no family group)
 */
export async function generateStudentInvoice({
  studentId,
  periodStart,
  periodEnd,
}: {
  studentId: string;
  periodStart: Date;
  periodEnd: Date;
}): Promise<BillingResult> {
  const units = [
    ...(await classUnits({ id: studentId }, periodStart, periodEnd)),
    ...(await registrationUnits({ id: studentId }, periodEnd)),
  ];

  const lineItems: LineItem[] = [];
  let totalCents = 0;
  for (const unit of units) {
    for (const line of unit.lines) lineItems.push({ ...line, type: "TUITION" });
    totalCents += unit.priceCents;
  }

  // Apply student scholarships
  const scholarships = await prisma.scholarship.findMany({
    where: {
      studentId,
      startDate: { lte: periodEnd },
      OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
    },
  });

  totalCents = applyScholarships(scholarships, lineItems, totalCents);

  return {
    lineItems,
    totalCents,
    enrollmentCount: units.length,
    registrationCharges: units.flatMap((u) => u.charges),
  };
}
