import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock } from "lucide-react";

import { ParallaxPhoto } from "@/components/public/parallax-photo";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/public/reveal";
import { SessionRow } from "@/components/public/session-row";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/link-button";
import {
  getPublicClasses,
  getPublicSchedule,
  getPublicStudio,
  getPublicTeachers,
} from "@/lib/db/public";
import { PLAN_UNITS, type BillingPlan } from "@/lib/registration-billing";
import { formatShortDay } from "@/lib/schedule-format";
import { formatCurrency } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const studio = await getPublicStudio();
  return {
    title: studio.name,
    description: `Dance classes for every age and level at ${studio.name}. Browse the schedule and register online.`,
  };
}

/** Per-class price when single dates can be booked, otherwise the first term option. */
function headlinePrice(cls: {
  basePriceCents: number;
  dropInEnabled: boolean;
  prices: { plan: BillingPlan; priceCents: number }[];
}) {
  if (cls.dropInEnabled) return { priceCents: cls.basePriceCents, unit: PLAN_UNITS.PER_CLASS };
  for (const plan of ["MONTHLY", "SEMESTER", "WEEKLY", "ANNUAL"] as const) {
    const price = cls.prices.find((p) => p.plan === plan);
    if (price) return { priceCents: price.priceCents, unit: PLAN_UNITS[plan] };
  }
  return { priceCents: cls.basePriceCents, unit: PLAN_UNITS.PER_CLASS };
}

export default async function HomePage() {
  const [studio, classes, schedule, teachers] = await Promise.all([
    getPublicStudio(),
    getPublicClasses(),
    getPublicSchedule({ days: 14, take: 5 }),
    getPublicTeachers(),
  ]);

  return (
    <>
      <section className="border-b bg-gradient-to-b from-accent to-background">
        <Reveal className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent-foreground">
            {studio.name}
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Find your rhythm. Classes for every age and level.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Browse the schedule, pick a class and register online in a couple of minutes.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/schedule" variant="cta" className="h-11 px-6 text-base">
              <CalendarDays className="mr-1 h-4 w-4" aria-hidden />
              View schedule
            </LinkButton>
            <LinkButton href="/register" variant="outline" className="h-11 px-6 text-base">
              Create an account
            </LinkButton>
          </div>
        </Reveal>
      </section>

      <section aria-labelledby="classes-heading" className="relative isolate overflow-hidden">
        {/* The studio photo at full brightness, drifting slowly behind frosted class cards */}
        <ParallaxPhoto src="/images/classes-studio.webp" />
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <h2
          id="classes-heading"
          className="text-2xl font-bold tracking-tight text-white [text-shadow:0_0_28px_rgb(0_0_0/0.4),0_0_10px_rgb(0_0_0/0.18)]"
        >
          Our classes
        </h2>
        <p className="mt-1 text-white [text-shadow:0_0_22px_rgb(0_0_0/0.45),0_0_8px_rgb(0_0_0/0.2)]">
          Book a single class, or register for a whole term.
        </p>

        {classes.length === 0 ? (
          <p className="mt-8 rounded-2xl bg-white p-8 text-center text-muted-foreground shadow-sm">
            Classes will be announced soon.
          </p>
        ) : (
          <StaggerGroup className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => (
              <StaggerItem key={cls.id}>
                <Link
                  href={`/classes/${cls.id}`}
                  className="beam-border group flex h-full flex-col rounded-2xl border border-white/60 bg-white/80 p-6 shadow-lg backdrop-blur-md transition duration-300 ease-out hover:-translate-y-1.5 hover:bg-white/90 hover:shadow-2xl focus-visible:-translate-y-1.5 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <div className="flex flex-wrap gap-2">
                    {cls.danceStyle && (
                      <Badge className="bg-domain-classes text-domain-classes-foreground">
                        {cls.danceStyle}
                      </Badge>
                    )}
                    {cls.skillLevel && <Badge variant="outline">{cls.skillLevel}</Badge>}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{cls.name}</h3>
                  {cls.description && (
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                      {cls.description}
                    </p>
                  )}
                  <div className="mt-auto flex items-end justify-between pt-6">
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {cls.defaultDurationMins} min
                      </p>
                      <p>
                        {cls.nextStart
                          ? `Next: ${formatShortDay(cls.nextStart, studio.timezone)}`
                          : "No dates scheduled yet"}
                      </p>
                    </div>
                    <p className="text-right text-lg font-bold text-foreground">
                      {formatCurrency(headlinePrice(cls).priceCents)}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {headlinePrice(cls).unit}
                      </span>
                    </p>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </StaggerGroup>
        )}
        </div>
      </section>

      {schedule.length > 0 && (
        <section aria-labelledby="upcoming-heading" className="border-y bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="upcoming-heading" className="text-2xl font-bold tracking-tight">
                Coming up
              </h2>
              <Link
                href="/schedule"
                className="flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Full schedule <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <div className="mt-6 divide-y rounded-2xl border border-border/50 bg-white shadow-sm">
              {schedule.map((session) => (
                <SessionRow key={session.id} session={session} timeZone={studio.timezone} showDay />
              ))}
            </div>
          </div>
        </section>
      )}

      {teachers.length > 0 && (
        <section aria-labelledby="teachers-heading" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 id="teachers-heading" className="text-2xl font-bold tracking-tight">
            Meet the teachers
          </h2>
          <StaggerGroup className="mt-8 grid gap-5 md:grid-cols-2">
            {teachers.map((teacher) => (
              <StaggerItem key={teacher.id}>
                <div className="h-full rounded-2xl border border-border/50 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-domain-people text-base font-semibold text-domain-people-foreground"
                    >
                      {teacher.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    <div>
                      <h3 className="font-semibold">{teacher.name}</h3>
                      {teacher.specialties.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {teacher.specialties.join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                  {teacher.bio && <p className="mt-4 text-sm text-muted-foreground">{teacher.bio}</p>}
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </section>
      )}
    </>
  );
}
