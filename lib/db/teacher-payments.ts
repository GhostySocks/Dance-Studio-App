import { getTeacherReport } from "@/lib/db/teacher-report";
import { prisma } from "@/lib/prisma";
import type { PayBasis } from "@/lib/teacher-report";
import { dayIn } from "@/lib/timezone";

/** A problem the admin can fix; its message is safe to show. */
export class TeacherPaymentError extends Error {}

const paymentSelect = {
  id: true,
  startDay: true,
  endDay: true,
  classes: true,
  minutes: true,
  basis: true,
  rateCents: true,
  amountCents: true,
  paidOn: true,
  reference: true,
  note: true,
} as const;

export interface TeacherPaymentRecord {
  id: string;
  startDay: string;
  endDay: string;
  classes: number;
  minutes: number;
  basis: string | null;
  rateCents: number | null;
  amountCents: number;
  paidOn: string;
  reference: string | null;
  note: string | null;
}

/** Every payment recorded for a teacher, latest period first. */
export async function getTeacherPayments(teacherId: string): Promise<TeacherPaymentRecord[]> {
  return prisma.teacherPayment.findMany({
    where: { teacherId },
    select: paymentSelect,
    orderBy: [{ startDay: "desc" }, { createdAt: "desc" }],
  });
}

/**
 * Records a payment made to a teacher for a period. Refused when any day of the
 * period is already covered by another payment (it would pay those classes
 * twice), or when the period has not finished (classes later in it would be
 * marked paid without being counted). The class and time totals are taken from
 * the report at this moment.
 */
export async function recordTeacherPayment({
  teacherId,
  startDay,
  endDay,
  amountCents,
  basis,
  rateCents,
  paidOn,
  reference,
  note,
  timeZone,
  actorId,
}: {
  teacherId: string;
  startDay: string;
  endDay: string;
  amountCents: number;
  basis?: PayBasis;
  rateCents?: number;
  paidOn: string;
  reference?: string;
  note?: string;
  timeZone: string;
  actorId: string;
}): Promise<TeacherPaymentRecord> {
  if (endDay > dayIn(timeZone, new Date())) {
    throw new TeacherPaymentError(
      "This period has not finished yet. End it today or earlier, so classes later in it are not marked as paid."
    );
  }
  const report = await getTeacherReport({ teacherId, startDay, endDay, timeZone });
  if (!report) throw new TeacherPaymentError("Teacher not found");

  return prisma.$transaction(async (tx) => {
    const clash = await tx.teacherPayment.findFirst({
      where: { teacherId, startDay: { lte: endDay }, endDay: { gte: startDay } },
      select: { startDay: true, endDay: true, paidOn: true },
      orderBy: { startDay: "asc" },
    });
    if (clash) {
      throw new TeacherPaymentError(
        `${report.teacher.name} was already paid for ${clash.startDay} to ${clash.endDay} (paid ${clash.paidOn}). Choose a period that does not overlap it.`
      );
    }
    const withRate = basis !== undefined && rateCents !== undefined;
    const payment = await tx.teacherPayment.create({
      data: {
        teacherId,
        startDay,
        endDay,
        classes: report.totals.classes,
        minutes: report.totals.minutes,
        basis: withRate ? basis : null,
        rateCents: withRate ? rateCents : null,
        amountCents,
        paidOn,
        reference: reference || null,
        note: note || null,
        recordedById: actorId,
      },
      select: paymentSelect,
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: "TEACHER_PAYMENT_RECORDED",
        entityType: "TeacherPayment",
        entityId: payment.id,
        meta: { teacherId, startDay, endDay, amountCents, paidOn, classes: payment.classes, minutes: payment.minutes },
      },
    });
    return payment;
  });
}

/** Removes a payment record (for one entered by mistake). Returns false if it was not found. */
export async function deleteTeacherPayment({
  teacherId,
  paymentId,
  actorId,
}: {
  teacherId: string;
  paymentId: string;
  actorId: string;
}): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.teacherPayment.findFirst({
      where: { id: paymentId, teacherId },
      select: { id: true, startDay: true, endDay: true, amountCents: true, paidOn: true },
    });
    if (!payment) return false;
    await tx.teacherPayment.delete({ where: { id: payment.id } });
    await tx.auditLog.create({
      data: {
        actorId,
        action: "TEACHER_PAYMENT_REMOVED",
        entityType: "TeacherPayment",
        entityId: payment.id,
        meta: {
          teacherId,
          startDay: payment.startDay,
          endDay: payment.endDay,
          amountCents: payment.amountCents,
          paidOn: payment.paidOn,
        },
      },
    });
    return true;
  });
}
