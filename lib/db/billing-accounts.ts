import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

/**
 * A billing account is whoever an invoice is addressed to: a FamilyGroup, or a
 * Student who is billed on their own. Auto-pay settings live on that record.
 */
export interface BillingAccountRef {
  type: "family" | "student";
  id: string;
}

const accountSelect = {
  id: true,
  stripeCustomerId: true,
  stripePaymentMethodId: true,
  autoPayEnabled: true,
} as const;

export async function getBillingAccount(ref: BillingAccountRef) {
  if (ref.type === "family") {
    const family = await prisma.familyGroup.findUnique({
      where: { id: ref.id },
      select: { ...accountSelect, name: true },
    });
    return family;
  }
  const student = await prisma.student.findUnique({
    where: { id: ref.id },
    select: { ...accountSelect, firstName: true, lastName: true },
  });
  if (!student) return null;
  const { firstName, lastName, ...rest } = student;
  return { ...rest, name: `${firstName} ${lastName}` };
}

/** Billing accounts a parent (or self-paying adult student) can manage. */
export async function getUserBillingAccounts(userId: string) {
  const [guardian, selfStudent] = await Promise.all([
    prisma.guardian.findUnique({
      where: { userId },
      select: {
        familyGroups: {
          select: { familyGroup: { select: { ...accountSelect, name: true } } },
        },
        students: {
          where: { familyGroupId: null },
          select: { ...accountSelect, firstName: true, lastName: true },
        },
      },
    }),
    prisma.student.findFirst({
      where: { userId, familyGroupId: null },
      select: { ...accountSelect, firstName: true, lastName: true },
    }),
  ]);

  const students = [...(guardian?.students ?? []), ...(selfStudent ? [selfStudent] : [])];
  const seen = new Set<string>();

  return [
    ...(guardian?.familyGroups ?? []).map(({ familyGroup }) => ({
      type: "family" as const,
      id: familyGroup.id,
      name: familyGroup.name,
      autoPayEnabled: familyGroup.autoPayEnabled,
      hasCard: !!familyGroup.stripePaymentMethodId,
    })),
    ...students
      .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
      .map((s) => ({
        type: "student" as const,
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        autoPayEnabled: s.autoPayEnabled,
        hasCard: !!s.stripePaymentMethodId,
      })),
  ];
}

export async function userOwnsBillingAccount(userId: string, ref: BillingAccountRef) {
  const accounts = await getUserBillingAccounts(userId);
  return accounts.some((a) => a.type === ref.type && a.id === ref.id);
}

/** Admins can access any invoice; everyone else only invoices addressed to them. */
export async function canUserAccessInvoice(
  user: { id: string; role: UserRole },
  invoiceId: string
) {
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;

  const count = await prisma.invoice.count({
    where: {
      id: invoiceId,
      OR: [
        { familyGroup: { guardians: { some: { guardian: { userId: user.id } } } } },
        { student: { guardian: { userId: user.id } } },
        { student: { userId: user.id } },
      ],
    },
  });
  return count > 0;
}

export async function updateBillingAccount(
  ref: BillingAccountRef,
  data: {
    stripeCustomerId?: string;
    stripePaymentMethodId?: string | null;
    autoPayEnabled?: boolean;
  },
  audit?: { actorId: string | null; action: "AUTOPAY_ENABLED" | "AUTOPAY_DISABLED"; reason?: string }
) {
  if (ref.type === "family") {
    await prisma.familyGroup.update({ where: { id: ref.id }, data, select: { id: true } });
  } else {
    await prisma.student.update({ where: { id: ref.id }, data, select: { id: true } });
  }

  if (audit) {
    await prisma.auditLog.create({
      data: {
        actorId: audit.actorId,
        action: audit.action,
        entityType: ref.type === "family" ? "FamilyGroup" : "Student",
        entityId: ref.id,
        meta: audit.reason ? { reason: audit.reason } : undefined,
      },
    });
  }
}

/** Turns auto-pay off for every account tied to a Stripe customer. Returns the affected accounts. */
export async function disableAutoPayByCustomer(stripeCustomerId: string, reason: string) {
  const [families, students] = await Promise.all([
    prisma.familyGroup.findMany({
      where: { stripeCustomerId, autoPayEnabled: true },
      select: { id: true, name: true },
    }),
    prisma.student.findMany({
      where: { stripeCustomerId, autoPayEnabled: true },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const affected: (BillingAccountRef & { name: string })[] = [
    ...families.map((f) => ({ type: "family" as const, id: f.id, name: f.name })),
    ...students.map((s) => ({
      type: "student" as const,
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
    })),
  ];

  for (const account of affected) {
    await updateBillingAccount(
      { type: account.type, id: account.id },
      { autoPayEnabled: false },
      { actorId: null, action: "AUTOPAY_DISABLED", reason }
    );
  }

  return affected;
}

const AUTOPAY_RETRY_DAYS = 3;
/** Stripe's minimum charge for USD. */
const MIN_CHARGE_CENTS = 50;

/**
 * Unpaid invoices whose billing account has auto-pay on. An invoice is skipped if it
 * already has a paid payment, or any payment attempt in the last few days, so a
 * declined card is retried every few days rather than every night.
 */
export async function getAutoPayDueInvoices(now: Date = new Date()) {
  const retryAfter = new Date(now.getTime() - AUTOPAY_RETRY_DAYS * 24 * 60 * 60 * 1000);
  const ready = { autoPayEnabled: true, stripeCustomerId: { not: null }, stripePaymentMethodId: { not: null } };

  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ["SENT", "OVERDUE"] },
      totalCents: { gte: MIN_CHARGE_CENTS },
      payments: { none: { OR: [{ status: "PAID" }, { createdAt: { gte: retryAfter } }] } },
      OR: [{ familyGroup: ready }, { student: ready }, { student: { familyGroup: ready } }],
    },
    select: {
      id: true,
      totalCents: true,
      familyGroup: { select: accountSelect },
      student: { select: { ...accountSelect, familyGroup: { select: accountSelect } } },
    },
    orderBy: { createdAt: "asc" },
  });

  return invoices.flatMap((invoice) => {
    // The invoice's own account first, then the student's family as a fallback
    const account = [invoice.familyGroup, invoice.student, invoice.student?.familyGroup].find(
      (a) => a?.autoPayEnabled && a.stripeCustomerId && a.stripePaymentMethodId
    );
    if (!account?.stripeCustomerId || !account.stripePaymentMethodId) return [];
    return [
      {
        id: invoice.id,
        totalCents: invoice.totalCents,
        stripeCustomerId: account.stripeCustomerId,
        stripePaymentMethodId: account.stripePaymentMethodId,
      },
    ];
  });
}

/** SENT invoices past their due date become OVERDUE. Returns how many were moved. */
export async function markOverdueInvoices(now: Date = new Date()) {
  const result = await prisma.invoice.updateMany({
    where: { status: "SENT", dueDate: { lt: now } },
    data: { status: "OVERDUE" },
  });
  return result.count;
}
