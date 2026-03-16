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

export async function markPaymentPaid(stripePaymentIntentId: string) {
  const payment = await prisma.payment.update({
    where: { stripePaymentIntentId },
    data: { status: "PAID" },
  });

  // Check if invoice is fully paid
  const payments = await prisma.payment.findMany({
    where: { invoiceId: payment.invoiceId, status: "PAID" },
    select: { amountCents: true },
  });
  const totalPaid = payments.reduce((sum, p) => sum + p.amountCents, 0);

  const invoice = await prisma.invoice.findUnique({
    where: { id: payment.invoiceId },
    select: { totalCents: true },
  });

  if (invoice && totalPaid >= invoice.totalCents) {
    await prisma.invoice.update({
      where: { id: payment.invoiceId },
      data: { status: "PAID" },
    });
  }

  return payment;
}

export async function markPaymentFailed(stripePaymentIntentId: string) {
  return prisma.payment.update({
    where: { stripePaymentIntentId },
    data: { status: "FAILED" },
  });
}

export async function getPaymentsByInvoice(invoiceId: string) {
  return prisma.payment.findMany({
    where: { invoiceId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getParentInvoices(userId: string) {
  // Find guardian profile for this user
  const guardian = await prisma.guardian.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!guardian) return [];

  // Get family groups this guardian belongs to
  const familyGroupLinks = await prisma.familyGroupGuardian.findMany({
    where: { guardianId: guardian.id },
    select: { familyGroupId: true },
  });
  const familyGroupIds = familyGroupLinks.map((l) => l.familyGroupId);

  // Get students linked to this guardian
  const students = await prisma.student.findMany({
    where: { guardianId: guardian.id },
    select: { id: true },
  });
  const studentIds = students.map((s) => s.id);

  // Get invoices for these family groups and students
  return prisma.invoice.findMany({
    where: {
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
  const guardian = await prisma.guardian.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!guardian) return [];

  return prisma.student.findMany({
    where: { guardianId: guardian.id },
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
  const guardian = await prisma.guardian.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!guardian) return [];

  const students = await prisma.student.findMany({
    where: { guardianId: guardian.id },
    select: { id: true, firstName: true, lastName: true },
  });
  const studentIds = students.map((s) => s.id);

  const enrollments = await prisma.enrollment.findMany({
    where: {
      studentId: { in: studentIds },
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

  return enrollments;
}
