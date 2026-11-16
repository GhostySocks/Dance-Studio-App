import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";

import { LinkButton } from "@/components/link-button";
import { ClassCard } from "@/components/public/class-card";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/public/reveal";
import { getPublicClasses, getPublicStudio } from "@/lib/db/public";

export async function generateMetadata(): Promise<Metadata> {
  const studio = await getPublicStudio();
  return {
    title: "Classes",
    description: `Every class at ${studio.name}: styles, levels and prices. Pick one to see its dates and register.`,
  };
}

/** Every active class as a grid of tiles. */
export default async function ClassesPage() {
  const [studio, classes] = await Promise.all([getPublicStudio(), getPublicClasses()]);

  return (
    <>
      <section className="border-b bg-gradient-to-b from-accent to-background">
        <Reveal className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6 px-4 py-14 sm:px-6 sm:py-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-accent-foreground">{studio.name}</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">Our classes</h1>
            <p className="mt-3 max-w-xl text-lg text-muted-foreground">
              {classes.length > 0
                ? `${classes.length} ${classes.length === 1 ? "class" : "classes"} for every age and level. Pick one to see its dates, then book a single class or register for a whole term.`
                : "Classes will be announced soon."}
            </p>
          </div>
          <LinkButton href="/schedule" variant="outline" className="h-11 px-6 text-base">
            <CalendarDays className="mr-1 h-4 w-4" aria-hidden />
            View schedule
          </LinkButton>
        </Reveal>
      </section>

      {classes.length > 0 && (
        <section aria-label="All classes" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <StaggerGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => (
              <StaggerItem key={cls.id}>
                <ClassCard cls={cls} timeZone={studio.timezone} />
              </StaggerItem>
            ))}
          </StaggerGroup>
        </section>
      )}
    </>
  );
}
