import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { CalendarRange, Clock, MapPin, User } from "lucide-react";

import { PortalEnrollForm, type EnrollTarget } from "@/components/forms/portal-enroll-form";
import { RegisterForm } from "@/components/forms/register-form";
import { LinkButton } from "@/components/link-button";
import { authOptions } from "@/lib/auth";
import { getPublicSession, getPublicStudio, type PublicSession } from "@/lib/db/public";
import { getEnrollableStudents, getExistingEnrollments } from "@/lib/db/registration";
import { getExistingRegistrations, getRegistrationOptions } from "@/lib/db/registrations";
import { hasRole } from "@/lib/permissions";
import { portalHome } from "@/lib/portal";
import { PLAN_HINTS, PLAN_LABELS, PLAN_UNITS, isTermPlan, type TermPlan } from "@/lib/registration-billing";
import { formatDayHeading, formatShortDay, formatTimeRange, spotsLabel } from "@/lib/schedule-format";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Register",
  description: "Create an account and register for a class.",
};

function SelectedClass({ session, timeZone }: { session: PublicSession; timeZone: string }) {
  return (
    <div className="rounded-2xl border border-primary/30 bg-accent p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent-foreground">
        Selected class
      </p>
      <p className="mt-1 text-lg font-semibold">{session.template.name}</p>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {formatDayHeading(session.startTime, timeZone)},{" "}
          {formatTimeRange(session.startTime, session.endTime, timeZone)}
        </span>
        <span className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" aria-hidden />
          {session.teacherName}
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          {session.roomName}
        </span>
      </div>
      <p className="mt-3 text-sm">
        <span className="font-semibold">{formatCurrency(session.template.basePriceCents)}</span>
        <span className="text-muted-foreground"> per class · {spotsLabel(session.spotsLeft)}</span>
      </p>
      {session.spotsLeft <= 0 && (
        <p className="mt-2 text-sm text-domain-alert-foreground">
          This class is full. Registering adds you to the waitlist, and you will be moved in
          automatically if a spot opens.
        </p>
      )}
    </div>
  );
}

interface TermSelection {
  templateId: string;
  termId: string;
  plan: TermPlan;
  className: string;
  covers: string;
  dates: number;
  firstDate: string | null;
  priceCents: number;
}

function SelectedTerm({ selection, timeZone }: { selection: TermSelection; timeZone: string }) {
  return (
    <div className="rounded-2xl border border-primary/30 bg-accent p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent-foreground">
        Selected registration
      </p>
      <p className="mt-1 text-lg font-semibold">
        {selection.className} · {selection.covers}
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CalendarRange className="h-3.5 w-3.5" aria-hidden />
          {selection.dates} class{selection.dates === 1 ? "" : "es"}
          {selection.firstDate ? `, starting ${formatShortDay(selection.firstDate, timeZone)}` : ""}
        </span>
      </p>
      <p className="mt-3 text-sm">
        <span className="font-semibold">{formatCurrency(selection.priceCents)}</span>
        <span className="text-muted-foreground">
          {" "}
          {PLAN_UNITS[selection.plan]} · {PLAN_LABELS[selection.plan]} billing
        </span>
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {PLAN_HINTS[selection.plan]} Any date that is already full is waitlisted.
      </p>
    </div>
  );
}

function first(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const sessionId = first(searchParams.session);
  const classId = first(searchParams.class);
  const termId = first(searchParams.term);
  const plan = first(searchParams.plan);

  const [studio, auth, selected, options] = await Promise.all([
    getPublicStudio(),
    getServerSession(authOptions),
    sessionId ? getPublicSession(sessionId) : null,
    classId && termId ? getRegistrationOptions(classId) : null,
  ]);

  // A term registration: class + term + plan, all still on offer
  let termSelection: TermSelection | null = null;
  if (options && termId && plan && isTermPlan(plan)) {
    const term = options.terms.find((t) => t.termId === termId);
    const choice = term?.plans.find((p) => p.plan === plan);
    if (term && choice) {
      termSelection = {
        templateId: options.template.id,
        termId: term.termId,
        plan: choice.plan,
        className: options.template.name,
        covers: choice.covers,
        dates: choice.dates,
        firstDate: term.firstDate,
        priceCents: choice.priceCents,
      };
    }
  }

  const asked = !!sessionId || !!(classId && termId);
  // Single dates are only bookable when the class allows it
  const singleDate = selected && selected.template.dropInEnabled ? selected : null;
  const unavailable = asked && !singleDate && !termSelection;
  const target: EnrollTarget | null = termSelection
    ? {
        kind: "term",
        templateId: termSelection.templateId,
        termId: termSelection.termId,
        plan: termSelection.plan,
      }
    : singleDate
      ? { kind: "session", sessionId: singleDate.id }
      : null;

  let body: React.ReactNode;
  if (!auth) {
    body = (
      <RegisterForm
        sessionId={singleDate?.id}
        termChoice={target?.kind === "term" ? target : undefined}
      />
    );
  } else if (!hasRole(auth, "PARENT", "STUDENT")) {
    body = (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          You are signed in as staff. Enroll students from the admin Enrollments or Registrations
          pages.
        </p>
        <LinkButton href={portalHome(auth.user.role)} className="h-10 px-5">
          Go to dashboard
        </LinkButton>
      </div>
    );
  } else if (!target) {
    body = (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          You already have an account. Pick a class from the schedule to enroll.
        </p>
        <LinkButton href="/schedule" className="h-10 px-5">
          View schedule
        </LinkButton>
      </div>
    );
  } else {
    const students = await getEnrollableStudents(auth.user.id);
    const ids = students.map((s) => s.id);
    const taken = new Map<string, string>();
    if (target.kind === "term") {
      for (const id of await getExistingRegistrations(ids, target.templateId, target.termId)) {
        taken.set(id, "Already registered");
      }
    } else {
      for (const e of await getExistingEnrollments(ids, target.sessionId)) {
        taken.set(e.studentId, e.status === "ACTIVE" ? "Already enrolled" : "On the waitlist");
      }
    }

    body =
      students.length === 0 ? (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            There are no dancers on your account yet. Add a child first, then come back to enroll.
          </p>
          <LinkButton href="/parent/students" className="h-10 px-5">
            Add a child
          </LinkButton>
        </div>
      ) : (
        <PortalEnrollForm
          target={target}
          doneHref={portalHome(auth.user.role)}
          students={students.map((s) => ({
            id: s.id,
            name: `${s.firstName} ${s.lastName}`,
            taken: taken.get(s.id) ?? null,
          }))}
        />
      );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">
        {auth && target ? (target.kind === "term" ? "Register for the term" : "Enroll in a class") : "Register"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {auth
          ? `Signed in as ${auth.user.name}.`
          : `Create your ${studio.name} account. You can add more classes any time.`}
      </p>

      <div className="mt-8 space-y-8">
        {unavailable && (
          <p role="alert" className="rounded-xl bg-domain-alert px-4 py-3 text-sm text-domain-alert-foreground">
            That option is no longer available.{" "}
            <Link href="/schedule" className="font-medium underline underline-offset-4">
              See the current schedule
            </Link>
            .
          </p>
        )}
        {termSelection ? (
          <SelectedTerm selection={termSelection} timeZone={studio.timezone} />
        ) : (
          singleDate && <SelectedClass session={singleDate} timeZone={studio.timezone} />
        )}
        <div className="rounded-2xl border border-border/50 bg-white p-6 shadow-sm sm:p-8">{body}</div>
      </div>
    </div>
  );
}
