import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Tag } from "lucide-react";

import { SessionRow } from "@/components/public/session-row";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/link-button";
import { getPublicClass, getPublicStudio } from "@/lib/db/public";
import { getRegistrationOptions } from "@/lib/db/registrations";
import { PLAN_HINTS, PLAN_LABELS, PLAN_UNITS } from "@/lib/registration-billing";
import { formatCurrency } from "@/lib/utils";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const cls = await getPublicClass(params.id);
  if (!cls) return { title: "Class not found" };
  return { title: cls.name, description: cls.description ?? undefined };
}

export default async function ClassDetailPage({ params }: { params: { id: string } }) {
  const [studio, cls, options] = await Promise.all([
    getPublicStudio(),
    getPublicClass(params.id),
    getRegistrationOptions(params.id),
  ]);
  if (!cls) notFound();
  const terms = options?.terms ?? [];
  const day = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: studio.timezone }).format(
      new Date(iso)
    );

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Link
        href="/schedule"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to schedule
      </Link>

      <div className="mt-6 rounded-2xl border border-border/50 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap gap-2">
          {cls.danceStyle && (
            <Badge className="bg-domain-classes text-domain-classes-foreground">{cls.danceStyle}</Badge>
          )}
          {cls.skillLevel && <Badge variant="outline">{cls.skillLevel}</Badge>}
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">{cls.name}</h1>
        {cls.description && (
          <p className="mt-4 max-w-2xl whitespace-pre-line text-muted-foreground">{cls.description}</p>
        )}
        <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
          <div>
            <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              Length
            </dt>
            <dd className="text-lg font-semibold">{cls.defaultDurationMins} minutes</dd>
          </div>
          {cls.dropInEnabled && (
            <div>
              <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Tag className="h-3.5 w-3.5" aria-hidden />
                Price per class
              </dt>
              <dd className="text-lg font-semibold">{formatCurrency(cls.basePriceCents)}</dd>
            </div>
          )}
        </dl>
      </div>

      {terms.length > 0 && (
        <section id="register" aria-labelledby="register-heading" className="scroll-mt-24">
          <h2 id="register-heading" className="mt-10 text-xl font-bold tracking-tight">
            Register for the term
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One registration books every class date in the term. Choose how you would like to pay.
          </p>
          <div className="mt-4 space-y-4">
            {terms.map((term) => (
              <div key={term.termId} className="rounded-2xl border border-border/50 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-lg font-semibold">{term.termName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {day(term.startDate)} – {day(term.endDate)} · {term.dates} class
                    {term.dates === 1 ? "" : "es"} remaining
                  </p>
                </div>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {term.plans.map((plan) => (
                    <li
                      key={plan.plan}
                      className="flex flex-col rounded-xl border border-border/60 p-4"
                    >
                      <p className="text-sm font-medium text-muted-foreground">{PLAN_LABELS[plan.plan]}</p>
                      <p className="mt-1 text-2xl font-bold">
                        {formatCurrency(plan.priceCents)}
                        <span className="ml-1 text-sm font-normal text-muted-foreground">
                          {PLAN_UNITS[plan.plan]}
                        </span>
                      </p>
                      <p className="mt-1 flex-1 text-sm text-muted-foreground">
                        {PLAN_HINTS[plan.plan]}
                        {plan.plan === "ANNUAL" ? ` Covers ${plan.covers} (${plan.dates} classes).` : ""}
                      </p>
                      <LinkButton
                        href={`/register?class=${cls.id}&term=${term.termId}&plan=${plan.plan}`}
                        className="mt-4 h-9 px-4"
                      >
                        Register
                        <span className="sr-only">
                          {" "}
                          for {term.termName}, {PLAN_LABELS[plan.plan].toLowerCase()} billing
                        </span>
                      </LinkButton>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {terms.length === 0 && !cls.dropInEnabled && (
        <p className="mt-10 rounded-2xl bg-white p-6 text-sm text-muted-foreground shadow-sm">
          This class is booked by the term, and registration for the next term is not open yet.
          Please check back soon or contact the studio.
        </p>
      )}

      <h2 className="mt-10 text-xl font-bold tracking-tight">Upcoming dates</h2>
      {cls.sessions.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-white p-8 text-center text-muted-foreground shadow-sm">
          No dates are scheduled for this class yet. Check back soon.
        </p>
      ) : (
        <div className="mt-4 divide-y rounded-2xl border border-border/50 bg-white shadow-sm">
          {cls.sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              timeZone={studio.timezone}
              showClass={false}
              showDay
            />
          ))}
        </div>
      )}
    </div>
  );
}
