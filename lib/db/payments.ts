import { prisma } from "@/lib/prisma";

export async function createPayment({
  invoiceId,
  amountCents,
  stripePaymentIntentId,
}: {
  invoiceId: string;
  amountCents: number;
  stripePaymentIntentId?: string;
}) {
  return prisma.payment.create({
    data: {
      invoiceId,
      amountCents,
      stripePaymentIntentId,
      status: "PENDING",
    },
  });
}

/**
 * Marks a payment PAID and, once the invoice is fully covered, marks the invoice PAID.
 * Idempotent: safe to call from the webhook, the confirm endpoint and the cron job
 * for the same PaymentIntent. Returns null if we have no record of the PaymentIntent.
 */
export async function markPaymentPaid(stripePaymentIntentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId },
    select: { id: true, invoiceId: true },
  });
  if (!payment) return null;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: "PAID" } },
      data: { status: "PAID" },
    });
    if (updated.count === 0) {
      return { invoiceId: payment.invoiceId, newlyPaid: false, invoicePaid: false };
    }

    const [paid, invoice] = await Promise.all([
      tx.payment.aggregate({
        where: { invoiceId: payment.invoiceId, status: "PAID" },
        _sum: { amountCents: true },
      }),
      tx.invoice.findUnique({
        where: { id: payment.invoiceId },
        select: { totalCents: true, status: true },
      }),
    ]);

    const invoicePaid =
      !!invoice &&
      invoice.status !== "VOID" &&
      (paid._sum.amountCents ?? 0) >= invoice.totalCents;

    if (invoicePaid && invoice.status !== "PAID") {
      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: { status: "PAID" },
      });
    }

    return { invoiceId: payment.invoiceId, newlyPaid: true, invoicePaid };
  });
}

/** Marks a pending payment FAILED. Idempotent; returns null for unknown PaymentIntents. */
export async function markPaymentFailed(stripePaymentIntentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId },
    select: { id: true, invoiceId: true },
  });
  if (!payment) return null;

  const updated = await prisma.payment.updateMany({
    where: { id: payment.id, status: "PENDING" },
    data: { status: "FAILED" },
  });
  return { invoiceId: payment.invoiceId, newlyFailed: updated.count > 0 };
}

export async function getPaymentByIntentId(stripePaymentIntentId: string) {
  return prisma.payment.findUnique({
    where: { stripePaymentIntentId },
    select: { id: true, invoiceId: true, status: true, amountCents: true },
  });
}

/** Most recent pending Stripe payment for an invoice, so an open PaymentIntent can be reused. */
export async function getPendingPayment(invoiceId: string) {
  return prisma.payment.findFirst({
    where: { invoiceId, status: "PENDING", stripePaymentIntentId: { not: null } },
    select: { id: true, amountCents: true, stripePaymentIntentId: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPaymentsByInvoice(invoiceId: string) {
  return prisma.payment.findMany({
    where: { invoiceId },
    orderBy: { createdAt: "desc" },
  });
}

/** Students a portal user sees: a guardian's children, or the adult student themself. */
function ownStudents(userId: string) {
  return { OR: [{ guardian: { userId } }, { userId }] };
}

export async function getParentInvoices(userId: string) {
  const [familyGroupLinks, students] = await Promise.all([
    prisma.familyGroupGuardian.findMany({
      where: { guardian: { userId } },
      select: { familyGroupId: true },
    }),
    prisma.student.findMany({ where: ownStudents(userId), select: { id: true } }),
  ]);
  const familyGroupIds = familyGroupLinks.map((l) => l.familyGroupId);
  const studentIds = students.map((s) => s.id);

  if (familyGroupIds.length === 0 && studentIds.length === 0) return [];

  return prisma.invoice.findMany({
    where: {
      // Drafts are internal until the studio sends them
      status: { not: "DRAFT" },
      OR: [
        ...(familyGroupIds.length > 0 ? [{ familyGroupId: { in: familyGroupIds } }] : []),
        ...(studentIds.length > 0 ? [{ studentId: { in: studentIds } }] : []),
      ],
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      familyGroup: { select: { id: true, name: true } },
      lineItems: true,
      payments: { select: { id: true, amountCents: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getParentStudents(userId: string) {
  return prisma.student.findMany({
    where: ownStudents(userId),
    include: {
      familyGroup: { select: { id: true, name: true } },
      enrollments: {
        where: { status: "ACTIVE" },
        include: {
          session: {
            include: {
              template: { select: { name: true, danceStyle: true } },
              teacher: { select: { user: { select: { name: true } } } },
              room: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { lastName: "asc" },
  });
}

export async function getParentSchedule(userId: string) {
  return prisma.enrollment.findMany({
    where: {
      student: ownStudents(userId),
      status: "ACTIVE",
      session: { startTime: { gte: new Date() } },
    },
    include: {
      student: { select: { firstName: true, lastName: true } },
      session: {
        include: {
          template: { select: { name: true, danceStyle: true } },
          teacher: { select: { user: { select: { name: true } } } },
          room: { select: { name: true } },
        },
      },
    },
    orderBy: { session: { startTime: "asc" } },
  });
}
