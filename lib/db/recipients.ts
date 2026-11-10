import { prisma } from "@/lib/prisma";

function unique(emails: (string | null | undefined)[]): string[] {
  return Array.from(
    new Set(emails.filter((e): e is string => !!e).map((e) => e.toLowerCase()))
  );
}

export async function getStudioInfo() {
  const studio = await prisma.studioProfile.findFirst({
    select: { name: true, timezone: true, email: true },
  });
  return {
    name: studio?.name ?? "Dance Studio",
    timezone: studio?.timezone ?? "America/New_York",
    email: studio?.email ?? null,
  };
}

export async function getAdminEmails(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: { email: true },
  });
  return unique(admins.map((a) => a.email));
}

/** Everything needed to email a student (or their guardian) about an enrollment. */
export async function getEnrollmentEmailContext(enrollmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      status: true,
      student: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          user: { select: { email: true } },
          guardian: { select: { user: { select: { email: true, name: true } } } },
        },
      },
      session: {
        select: {
          startTime: true,
          endTime: true,
          template: { select: { name: true } },
          teacher: { select: { user: { select: { name: true } } } },
          room: { select: { name: true } },
        },
      },
    },
  });

  if (!enrollment) return null;

  const { student } = enrollment;
  return {
    enrollment,
    recipientName: student.guardian?.user.name ?? student.firstName,
    recipients: unique([
      student.guardian?.user.email,
      student.user?.email,
      student.email,
    ]),
  };
}

/** Everything needed to email the payer(s) of an invoice. */
export async function getInvoiceEmailContext(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      status: true,
      totalCents: true,
      periodStart: true,
      periodEnd: true,
      dueDate: true,
      lineItems: {
        select: { id: true, description: true, amountCents: true, type: true },
        orderBy: { createdAt: "asc" },
      },
      student: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          user: { select: { email: true } },
          guardian: { select: { user: { select: { email: true } } } },
        },
      },
      familyGroup: {
        select: {
          name: true,
          guardians: {
            select: { guardian: { select: { user: { select: { email: true } } } } },
          },
        },
      },
    },
  });

  if (!invoice) return null;

  const billTo = invoice.familyGroup
    ? invoice.familyGroup.name
    : invoice.student
      ? `${invoice.student.firstName} ${invoice.student.lastName}`
      : "Customer";

  return {
    invoice,
    billTo,
    recipients: unique([
      ...(invoice.familyGroup?.guardians.map((g) => g.guardian.user.email) ?? []),
      invoice.student?.guardian?.user.email,
      invoice.student?.user?.email,
      invoice.student?.email,
    ]),
  };
}
