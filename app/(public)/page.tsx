import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";

import { ClassCard } from "@/components/public/class-card";
import { ClassCarousel } from "@/components/public/class-carousel";
import { HeroShapes } from "@/components/public/hero-shapes";
import { ParallaxPhoto } from "@/components/public/parallax-photo";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/public/reveal";
import { SessionRow } from "@/components/public/session-row";
import { LinkButton } from "@/components/link-button";
import {
  getPublicClasses,
  getPublicSchedule,
  getPublicStudio,
  getPublicTeachers,
} from "@/lib/db/public";

export async function generateMetadata(): Promise<Metadata> {
  const studio = await getPublicStudio();
  return {
    title: studio.name,
    description: `Dance classes for every age and level at ${studio.name}. Browse the schedule and register online.`,
  };
}

/** How many classes the home page shows at a time. */
const CLASSES_PER_PAGE = 6;

export default async function HomePage() {
  const [studio, classes, schedule, teachers] = await Promise.all([
    getPublicStudio(),
    getPublicClasses(),
    getPublicSchedule({ days: 14, take: 5 }),
    getPublicTeachers(),
  ]);

  const classPages: (typeof classes)[] = [];
  for (let i = 0; i < classes.length; i += CLASSES_PER_PAGE) {
    // The last page reaches back so it is always full (8 classes: 1 to 6, then 3 to 8)
    const start = Math.max(0, Math.min(i, classes.length - CLASSES_PER_PAGE));
    classPages.push(classes.slice(start, start + CLASSES_PER_PAGE));
  }

  return (
    <>
      <section className="overflow-hidden border-b bg-gradient-to-b from-accent to-background">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 md:grid-cols-[minmax(0,1fr)_17rem] md:py-24 lg:grid-cols-[minmax(0,1fr)_27rem]">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-widest text-accent-foreground">
            {studio.name}
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Confidence, one class at a time.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Classes for every age and level. Browse the schedule, pick a class and register online in a
            couple of minutes.
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
        <HeroShapes className="hidden md:block" />
        </div>
      </section>

      <section aria-labelledby="classes-heading" className="relative isolate overflow-hidden">
        {/* The studio photo at full brightness, drifting slowly behind frosted class cards */}
        <ParallaxPhoto src="/images/classes-studio.webp" />
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
        <h2
          id="classes-heading"
          className="text-2xl font-bold tracking-tight text-white [text-shadow:0_0_28px_rgb(0_0_0/0.4),0_0_10px_rgb(0_0_0/0.18)]"
        >
          Our classes
        </h2>
        <p className="mt-1 text-white [text-shadow:0_0_22px_rgb(0_0_0/0.45),0_0_8px_rgb(0_0_0/0.2)]">
          Book a single class, or register for a whole term.
        </p>
        </div>
        {classes.length > 0 && (
          <Link
            href="/classes"
            className="inline-flex items-center gap-1 rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-primary shadow-md backdrop-blur transition hover:bg-white"
          >
            View all {classes.length} classes
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
        </div>

        {classes.length === 0 ? (
          <p className="mt-8 rounded-2xl bg-white p-8 text-center text-muted-foreground shadow-sm">
            Classes will be announced soon.
          </p>
        ) : (
          <Reveal className="mt-8">
            <ClassCarousel
              label="Our classes"
              gridClassName="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
              pages={classPages.map((page) =>
                page.map((cls) => <ClassCard key={cls.id} cls={cls} timeZone={studio.timezone} glass />)
              )}
            />
          </Reveal>
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
