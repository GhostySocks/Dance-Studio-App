import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Tag } from "lucide-react";

import { SessionRow } from "@/components/public/session-row";
import { Badge } from "@/components/ui/badge";
import { getPublicClass, getPublicStudio } from "@/lib/db/public";
import { formatCurrency } from "@/lib/utils";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const cls = await getPublicClass(params.id);
  if (!cls) return { title: "Class not found" };
  return { title: cls.name, description: cls.description ?? undefined };
}

export default async function ClassDetailPage({ params }: { params: { id: string } }) {
  const [studio, cls] = await Promise.all([getPublicStudio(), getPublicClass(params.id)]);
  if (!cls) notFound();

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
          <div>
            <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Tag className="h-3.5 w-3.5" aria-hidden />
              Tuition
            </dt>
            <dd className="text-lg font-semibold">{formatCurrency(cls.basePriceCents)}</dd>
          </div>
        </dl>
      </div>

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
