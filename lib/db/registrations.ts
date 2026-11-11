import { prisma } from "@/lib/prisma";
import type { BillingPlan, Prisma } from "@prisma/client";

import { cancelEnrollment, enrollStudent } from "@/lib/db/enrollment";
import { isTermPlan, type TermPlan } from "@/lib/registration-billing";

/**
 * What can be registered for: the class, the plans the studio offers for it, and
 * each current or upcoming term with how many dates are still to come.
 * Public data only (no students).
 */
export async function getRegistrationOptions(templateId: string) {
  const now = new Date();
  const [template, terms] = await Promise.all([
    prisma.classTemplate.findFirst({
      where: { id: templateId, isActive: true },
      select: {
        id: true,
        name: true,
        danceStyle: true,
        skillLevel: true,
        basePriceCents: true,
        dropInEnabled: true,
        prices: { select: { plan: true, priceCents: true } },
      },
    }),
    prisma.term.findMany({
      where: { endDate: { gte: now } },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        season: { select: { id: true, name: true, startDate: true, endDate: true } },
      },
      orderBy: { startDate: "asc" },
    }),
  ]);
  if (!template) return null;

  const priceOf = (plan: BillingPlan) => template.prices.find((p) => p.plan === plan)?.priceCents;

  const options = [];
  for (const term of terms) {
    const from = term.startDate > now ? term.startDate : now;
    const [termDates, seasonDates, first] = await Promise.all([
      prisma.classSession.count({
        where: { templateId, startTime: { gte: from, lte: term.endDate } },
      }),
      term.season
        ? prisma.classSession.count({
            where: {
              templateId,
              startTime: {
                gte: term.season.startDate > now ? term.season.startDate : now,
                lte: term.season.endDate,
              },
            },
          })
        : 0,
      prisma.classSession.findFirst({
        where: { templateId, startTime: { gte: from, lte: term.endDate } },
        select: { startTime: true },
        orderBy: { startTime: "asc" },
      }),
    ]);
    if (termDates === 0) continue;

    const plans: { plan: TermPlan; priceCents: number; dates: number; covers: string }[] = [];
    for (const plan of ["WEEKLY", "MONTHLY", "SEMESTER"] as const) {
      const priceCents = priceOf(plan);
      if (priceCents !== undefined) plans.push({ plan, priceCents, dates: termDates, covers: term.name });
    }
    const annual = priceOf("ANNUAL");
    if (annual !== undefined && term.season && seasonDates > 0) {
      plans.push({ plan: "ANNUAL", priceCents: annual, dates: seasonDates, covers: term.season.name });
    }
    if (plans.length === 0) continue;

    options.push({
      termId: term.id,
      termName: term.name,
      startDate: term.startDate.toISOString(),
      endDate: term.endDate.toISOString(),
      firstDate: first?.startTime.toISOString() ?? null,
      dates: termDates,
      plans,
    });
  }

  return {
    template: {
      id: template.id,
      name: template.name,
      danceStyle: template.danceStyle,
      skillLevel: template.skillLevel,
      basePriceCents: template.basePriceCents,
      dropInEnabled: template.dropInEnabled,
    },
    terms: options,
  };
}

export type RegistrationOptions = NonNullable<Awaited<ReturnType<typeof getRegistrationOptions>>>;

export type CreateRegistrationResult =
  | { ok: true; registrationId: string; enrolled: number; waitlisted: number; alreadyBooked: number }
  | { ok: false; error: string };

/**
 * Registers a student for every remaining date of a class in a term (or in the
 * term's season, for ANNUAL). Each date goes through the normal capacity check, so
 * full dates are waitlisted rather than oversold.
 */
export async function createRegistration({
  studentId,
  templateId,
  termId,
  plan,
  actorId,
}: {
  studentId: string;
  templateId: string;
  termId: string;
  plan: string;
  actorId: string | null;
}): Promise<CreateRegistrationResult> {
  if (!isTermPlan(plan)) return { ok: false, error: "Choose a billing option" };

  const [template, term] = await Promise.all([
    prisma.classTemplate.findFirst({
      where: { id: templateId, isActive: true },
      select: { id: true, prices: { where: { plan }, select: { priceCents: true } } },
    }),
    prisma.term.findUnique({
      where: { id: termId },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        season: { select: { id: true, startDate: true, endDate: true } },
      },
    }),
  ]);
  if (!template) return { ok: false, error: "That class is no longer available" };
  if (!term) return { ok: false, error: "That term is no longer available" };

  const price = template.prices[0];
  if (!price) return { ok: false, error: "That billing option is not offered for this class" };

  const range = plan === "ANNUAL" ? term.season : term;
  if (!range) return { ok: false, error: "Annual registration is not available for this term" };

  const now = new Date();
  if (range.endDate < now) return { ok: false, error: "That term has already ended" };
  const startDate = range.startDate > now ? range.startDate : now;

  const overlapping = await prisma.registration.count({
    where: {
      studentId,
      templateId,
      status: "ACTIVE",
      startDate: { lte: range.endDate },
      endDate: { gte: startDate },
    },
  });
  if (overlapping > 0) {
    return { ok: false, error: "Already registered for this class in that period" };
  }

  const sessions = await prisma.classSession.findMany({
    where: { templateId, startTime: { gte: startDate, lte: range.endDate } },
    select: { id: true },
    orderBy: { startTime: "asc" },
  });
  if (sessions.length === 0) {
    return { ok: false, error: "There are no upcoming dates for this class in that term" };
  }

  const registration = await prisma.registration.create({
    data: {
      studentId,
      templateId,
      termId: term.id,
      seasonId: plan === "ANNUAL" ? term.season?.id : null,
      plan,
      priceCents: price.priceCents,
      startDate,
      endDate: range.endDate,
    },
    select: { id: true },
  });

  let enrolled = 0;
  let waitlisted = 0;
  let alreadyBooked = 0;
  for (const session of sessions) {
    const result = await enrollStudent({
      studentId,
      sessionId: session.id,
      registrationId: registration.id,
    });
    if (!result.success) alreadyBooked += 1; // booked earlier as a single class; left as it is
    else if (result.waitlist) waitlisted += 1;
    else enrolled += 1;
  }

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "REGISTRATION_CREATED",
      entityType: "Registration",
      entityId: registration.id,
      meta: { plan, enrolled, waitlisted, alreadyBooked },
    },
  });

  return { ok: true, registrationId: registration.id, enrolled, waitlisted, alreadyBooked };
}

/**
 * When dates are added to a class, students already registered for that term get
 * them too. Returns how many enrollments were added.
 */
export async function syncRegistrationsForTemplate(templateId: string) {
  const now = new Date();
  const registrations = await prisma.registration.findMany({
    where: { templateId, status: "ACTIVE", endDate: { gte: now } },
    select: { id: true, studentId: true, startDate: true, endDate: true },
  });

  let added = 0;
  for (const registration of registrations) {
    const from = registration.startDate > now ? registration.startDate : now;
    const missing = await prisma.classSession.findMany({
      where: {
        templateId,
        startTime: { gte: from, lte: registration.endDate },
        enrollments: { none: { studentId: registration.studentId } },
      },
      select: { id: true },
      orderBy: { startTime: "asc" },
    });
    for (const session of missing) {
      const result = await enrollStudent({
        studentId: registration.studentId,
        sessionId: session.id,
        registrationId: registration.id,
      });
      if (result.success) added += 1;
    }
  }
  return added;
}

/**
 * Cancels a registration from now on: future dates are released (promoting anyone
 * waitlisted) and no further instalments are charged. Past dates stay on record.
 */
export async function cancelRegistration(id: string, actorId: string | null) {
  const registration = await prisma.registration.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!registration) return null;
  if (registration.status === "CANCELLED") return { released: 0, alreadyCancelled: true };

  const now = new Date();
  const future = await prisma.enrollment.findMany({
    where: {
      registrationId: id,
      status: { in: ["ACTIVE", "WAITLIST"] },
      session: { startTime: { gt: now } },
    },
    select: { id: true },
  });
  for (const enrollment of future) await cancelEnrollment(enrollment.id);

  await prisma.registration.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: now },
    select: { id: true },
  });
  await prisma.auditLog.create({
    data: {
      actorId,
      action: "REGISTRATION_CANCELLED",
      entityType: "Registration",
      entityId: id,
      meta: { released: future.length },
    },
  });
  return { released: future.length, alreadyCancelled: false };
}

const listSelect = {
  id: true,
  plan: true,
  priceCents: true,
  status: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  student: { select: { id: true, firstName: true, lastName: true } },
  template: { select: { id: true, name: true } },
  term: { select: { id: true, name: true } },
  season: { select: { id: true, name: true } },
  enrollments: { select: { status: true } },
} satisfies Prisma.RegistrationSelect;

function summarize(row: Prisma.RegistrationGetPayload<{ select: typeof listSelect }>) {
  const { enrollments, ...rest } = row;
  return {
    ...rest,
    covers: row.season?.name ?? row.term?.name ?? "",
    dates: enrollments.filter((e) => e.status === "ACTIVE").length,
    waitlisted: enrollments.filter((e) => e.status === "WAITLIST").length,
  };
}

/** Admin list, newest first. */
export async function getRegistrations({
  search,
  status,
  page = 1,
  perPage = 20,
}: {
  search?: string;
  status?: string;
  page?: number;
  perPage?: number;
}) {
  const where: Prisma.RegistrationWhereInput = {};
  if (status === "ACTIVE" || status === "CANCELLED") where.status = status;
  if (search) {
    where.OR = [
      { student: { firstName: { contains: search, mode: "insensitive" } } },
      { student: { lastName: { contains: search, mode: "insensitive" } } },
      { template: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.registration.findMany({
      where,
      select: listSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.registration.count({ where }),
  ]);
  return { registrations: rows.map(summarize), total, totalPages: Math.ceil(total / perPage) };
}

/** Registrations of a portal user's own students (a guardian's children, or themself). */
export async function getOwnRegistrations(userId: string) {
  const rows = await prisma.registration.findMany({
    where: { student: { OR: [{ guardian: { userId } }, { userId }] } },
    select: listSelect,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(summarize);
}

/** Which of these students already has an active registration for the class in this term. */
export async function getExistingRegistrations(studentIds: string[], templateId: string, termId: string) {
  const term = await prisma.term.findUnique({
    where: { id: termId },
    select: { startDate: true, endDate: true },
  });
  if (!term) return [];
  const rows = await prisma.registration.findMany({
    where: {
      studentId: { in: studentIds },
      templateId,
      status: "ACTIVE",
      startDate: { lte: term.endDate },
      endDate: { gte: term.startDate },
    },
    select: { studentId: true },
  });
  return rows.map((r) => r.studentId);
}

/** Everything needed to email a confirmation for a registration. */
export async function getRegistrationEmailContext(id: string) {
  const registration = await prisma.registration.findUnique({
    where: { id },
    select: {
      plan: true,
      priceCents: true,
      status: true,
      student: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          user: { select: { email: true, name: true } },
          guardian: { select: { user: { select: { email: true, name: true } } } },
        },
      },
      template: { select: { name: true } },
      term: { select: { name: true } },
      season: { select: { name: true } },
      enrollments: {
        where: { status: { in: ["ACTIVE", "WAITLIST"] } },
        select: { status: true, session: { select: { startTime: true } } },
        orderBy: { session: { startTime: "asc" } },
      },
    },
  });
  if (!registration) return null;

  const { student } = registration;
  const recipients = Array.from(
    new Set(
      [student.guardian?.user.email, student.user?.email, student.email]
        .filter((e): e is string => !!e)
        .map((e) => e.toLowerCase())
    )
  );
  return {
    registration,
    recipients,
    recipientName: student.guardian?.user.name ?? student.user?.name ?? student.firstName,
  };
}

/** Registration data the invoice engine needs for a set of students. */
export async function getRegistrationsForBilling(studentWhere: Prisma.StudentWhereInput) {
  return prisma.registration.findMany({
    where: { student: studentWhere },
    select: {
      id: true,
      plan: true,
      priceCents: true,
      createdAt: true,
      studentId: true,
      student: { select: { firstName: true, lastName: true } },
      template: { select: { name: true } },
      term: { select: { name: true } },
      season: { select: { name: true } },
      // Dates the student actually holds: cancelled and waitlisted ones are not charged
      enrollments: {
        where: { status: "ACTIVE" },
        select: { session: { select: { startTime: true } } },
      },
      // Instalments already on an invoice that was not voided
      charges: {
        where: { invoice: { status: { not: "VOID" } } },
        select: { periodKey: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}
