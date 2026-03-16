import { prisma } from "@/lib/prisma";

interface EnrollmentForBilling {
  id: string;
  studentId: string;
  student: { firstName: string; lastName: string };
  session: {
    id: string;
    template: { name: string; danceStyle: string | null; basePriceCents: number };
  };
}

interface LineItem {
  description: string;
  amountCents: number;
  type: "TUITION" | "DISCOUNT" | "SCHOLARSHIP" | "FEE";
}

/**
 * Family Pricing Engine — implements the exact logic from CLAUDE.md:
 * 1. Collect all ACTIVE enrollments for all students in the family for the billing period
 * 2. Sort enrollments by basePriceCents descending (most expensive first)
 * 3. Apply full base price to enrollment[0]
 * 4. For enrollment[1+], evaluate PricingRules for this family group (or global rules)
 * 5. Rule types: PERCENT_OFF, FIXED_PRICE, FAMILY_CAP
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
}) {
  // 1. Collect all ACTIVE enrollments for students in this family
  const enrollments = await prisma.enrollment.findMany({
    where: {
      status: "ACTIVE",
      student: { familyGroupId },
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
  }) as unknown as EnrollmentForBilling[];

  if (enrollments.length === 0) {
    return { lineItems: [], totalCents: 0, enrollmentCount: 0 };
  }

  // 2. Sort by basePriceCents descending
  enrollments.sort(
    (a, b) => b.session.template.basePriceCents - a.session.template.basePriceCents
  );

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
          OR: [
            { familyGroupId },
            { student: { familyGroupId } },
          ],
        },
        { startDate: { lte: periodEnd } },
        {
          OR: [
            { endDate: null },
            { endDate: { gte: periodStart } },
          ],
        },
      ],
    },
  });

  const lineItems: LineItem[] = [];
  let runningTotal = 0;

  // 3 & 4. Apply pricing
  for (let i = 0; i < enrollments.length; i++) {
    const enrollment = enrollments[i];
    const basePriceCents = enrollment.session.template.basePriceCents;
    const studentName = `${enrollment.student.firstName} ${enrollment.student.lastName}`;
    const className = enrollment.session.template.name;

    // Full price for first enrollment
    if (i === 0) {
      lineItems.push({
        description: `${className} — ${studentName}`,
        amountCents: basePriceCents,
        type: "TUITION",
      });
      runningTotal += basePriceCents;
      continue;
    }

    // For subsequent enrollments, check pricing rules
    let discountedPrice = basePriceCents;
    let discountApplied = false;

    for (const rule of pricingRules) {
      // Rule applies if this is the Nth+ enrollment (1-indexed, so i+1 >= triggerCount)
      if (i + 1 >= rule.triggerCount) {
        switch (rule.discountType) {
          case "PERCENT_OFF": {
            discountedPrice = Math.round(
              basePriceCents * (1 - rule.discountValue / 100)
            );
            discountApplied = true;
            break;
          }
          case "FIXED_PRICE": {
            discountedPrice = rule.discountValue;
            discountApplied = true;
            break;
          }
          case "FAMILY_CAP": {
            // Will handle after all tuition items
            break;
          }
        }
      }
    }

    // Add tuition line item
    lineItems.push({
      description: `${className} — ${studentName}`,
      amountCents: basePriceCents,
      type: "TUITION",
    });
    runningTotal += basePriceCents;

    // Add discount line item if applicable
    if (discountApplied && discountedPrice < basePriceCents) {
      const discountAmount = basePriceCents - discountedPrice;
      lineItems.push({
        description: `Multi-class discount — ${className} — ${studentName}`,
        amountCents: -discountAmount,
        type: "DISCOUNT",
      });
      runningTotal -= discountAmount;
    }
  }

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

  // Ensure non-negative
  runningTotal = Math.max(0, runningTotal);

  return { lineItems, totalCents: runningTotal, enrollmentCount: enrollments.length };
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
}) {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      status: "ACTIVE",
      studentId,
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

  const lineItems: LineItem[] = [];
  let totalCents = 0;

  for (const enrollment of enrollments) {
    const price = enrollment.session.template.basePriceCents;
    lineItems.push({
      description: `${enrollment.session.template.name} — ${enrollment.student.firstName} ${enrollment.student.lastName}`,
      amountCents: price,
      type: "TUITION",
    });
    totalCents += price;
  }

  // Apply student scholarships
  const scholarships = await prisma.scholarship.findMany({
    where: {
      studentId,
      startDate: { lte: periodEnd },
      OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
    },
  });

  for (const scholarship of scholarships) {
    switch (scholarship.type) {
      case "PERCENT": {
        const credit = Math.round(totalCents * (scholarship.value / 100));
        if (credit > 0) {
          lineItems.push({
            description: `Scholarship: ${scholarship.name} (${scholarship.value}%)`,
            amountCents: -credit,
            type: "SCHOLARSHIP",
          });
          totalCents -= credit;
        }
        break;
      }
      case "FIXED": {
        const credit = Math.min(scholarship.value, totalCents);
        if (credit > 0) {
          lineItems.push({
            description: `Scholarship: ${scholarship.name}`,
            amountCents: -credit,
            type: "SCHOLARSHIP",
          });
          totalCents -= credit;
        }
        break;
      }
      case "WAIVER": {
        if (totalCents > 0) {
          lineItems.push({
            description: `Scholarship: ${scholarship.name} (Full waiver)`,
            amountCents: -totalCents,
            type: "SCHOLARSHIP",
          });
          totalCents = 0;
        }
        break;
      }
    }
  }

  totalCents = Math.max(0, totalCents);
  return { lineItems, totalCents, enrollmentCount: enrollments.length };
}
