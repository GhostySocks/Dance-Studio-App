import type { Metadata } from "next";

import { ScheduleBrowser } from "@/components/public/schedule-browser";
import { getPublicSchedule, getPublicStudio } from "@/lib/db/public";

export const metadata: Metadata = {
  title: "Class schedule",
  description: "Upcoming dance classes, with live availability.",
};

export default async function SchedulePage() {
  const [studio, sessions] = await Promise.all([getPublicStudio(), getPublicSchedule()]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Class schedule</h1>
      <p className="mt-2 text-muted-foreground">
        Upcoming classes for the next eight weeks. Times are shown in the studio&apos;s local time.
      </p>
      <div className="mt-8">
        <ScheduleBrowser sessions={sessions} timeZone={studio.timezone} />
      </div>
    </div>
  );
}
