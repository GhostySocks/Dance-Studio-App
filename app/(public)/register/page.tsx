import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { Clock, MapPin, User } from "lucide-react";

import { PortalEnrollForm } from "@/components/forms/portal-enroll-form";
import { RegisterForm } from "@/components/forms/register-form";
import { LinkButton } from "@/components/link-button";
import { authOptions } from "@/lib/auth";
import { getPublicSession, getPublicStudio, type PublicSession } from "@/lib/db/public";
import { getEnrollableStudents, getExistingEnrollments } from "@/lib/db/registration";
import { hasRole } from "@/lib/permissions";
import { portalHome } from "@/lib/portal";
import { formatDayHeading, formatTimeRange, spotsLabel } from "@/lib/schedule-format";
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

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: { session?: string | string[] };
}) {
  const sessionId = typeof searchParams.session === "string" ? searchParams.session : undefined;
  const [studio, auth, selected] = await Promise.all([
    getPublicStudio(),
    getServerSession(authOptions),
    sessionId ? getPublicSession(sessionId) : null,
  ]);

  const unavailable = sessionId && !selected;

  let body: React.ReactNode;
  if (!auth) {
    body = <RegisterForm sessionId={selected?.id} />;
  } else if (!hasRole(auth, "PARENT", "STUDENT")) {
    body = (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          You are signed in as staff. Enroll students from the admin enrollments page.
        </p>
        <LinkButton href={portalHome(auth.user.role)} className="h-10 px-5">
          Go to dashboard
        </LinkButton>
      </div>
    );
  } else if (!selected) {
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
    const existing = await getExistingEnrollments(
      students.map((s) => s.id),
      selected.id
    );
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
          sessionId={selected.id}
          doneHref={portalHome(auth.user.role)}
          students={students.map((s) => ({
            id: s.id,
            name: `${s.firstName} ${s.lastName}`,
            status:
              (existing.find((e) => e.studentId === s.id)?.status as "ACTIVE" | "WAITLIST" | undefined) ??
              null,
          }))}
        />
      );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">
        {auth && selected ? "Enroll in a class" : "Register"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {auth
          ? `Signed in as ${auth.user.name}.`
          : `Create your ${studio.name} account. You can add more classes any time.`}
      </p>

      <div className="mt-8 space-y-8">
        {unavailable && (
          <p role="alert" className="rounded-xl bg-domain-alert px-4 py-3 text-sm text-domain-alert-foreground">
            That class is no longer available.{" "}
            <Link href="/schedule" className="font-medium underline underline-offset-4">
              See the current schedule
            </Link>
            .
          </p>
        )}
        {selected && <SelectedClass session={selected} timeZone={studio.timezone} />}
        <div className="rounded-2xl border border-border/50 bg-white p-6 shadow-sm sm:p-8">{body}</div>
      </div>
    </div>
  );
}
