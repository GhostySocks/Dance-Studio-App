import Link from "next/link";
import { Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { PLAN_UNITS, type BillingPlan } from "@/lib/registration-billing";
import { formatShortDay } from "@/lib/schedule-format";
import { cn, formatCurrency } from "@/lib/utils";

export interface ClassCardData {
  id: string;
  name: string;
  description: string | null;
  danceStyle: string | null;
  skillLevel: string | null;
  defaultDurationMins: number;
  basePriceCents: number;
  dropInEnabled: boolean;
  prices: { plan: BillingPlan; priceCents: number }[];
  nextStart: string | null;
}

/** Per-class price when single dates can be booked, otherwise the first term option. */
function headlinePrice(cls: Pick<ClassCardData, "basePriceCents" | "dropInEnabled" | "prices">) {
  if (cls.dropInEnabled) return { priceCents: cls.basePriceCents, unit: PLAN_UNITS.PER_CLASS };
  for (const plan of ["MONTHLY", "SEMESTER", "WEEKLY", "ANNUAL"] as const) {
    const price = cls.prices.find((p) => p.plan === plan);
    if (price) return { priceCents: price.priceCents, unit: PLAN_UNITS[plan] };
  }
  return { priceCents: cls.basePriceCents, unit: PLAN_UNITS.PER_CLASS };
}

/**
 * One class as a tile linking to its page. `glass` is the frosted version that
 * sits on the studio photo (home page); the plain one sits on a page background.
 */
export function ClassCard({
  cls,
  timeZone,
  glass = false,
}: {
  cls: ClassCardData;
  timeZone: string;
  glass?: boolean;
}) {
  const price = headlinePrice(cls);
  return (
    <Link
      href={`/classes/${cls.id}`}
      className={cn(
        "beam-border group flex h-full flex-col rounded-2xl border p-6 transition duration-300 ease-out hover:-translate-y-1.5 focus-visible:-translate-y-1.5 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        glass
          ? "border-white/60 bg-white/80 shadow-lg backdrop-blur-md hover:bg-white/90 hover:shadow-2xl"
          : "border-border/50 bg-white shadow-sm hover:shadow-xl"
      )}
    >
      <div className="flex flex-wrap gap-2">
        {cls.danceStyle && (
          <Badge className="bg-domain-classes text-domain-classes-foreground">{cls.danceStyle}</Badge>
        )}
        {cls.skillLevel && <Badge variant="outline">{cls.skillLevel}</Badge>}
      </div>
      <h3 className="mt-4 text-lg font-semibold">{cls.name}</h3>
      {cls.description && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{cls.description}</p>}
      <div className="mt-auto flex items-end justify-between pt-6">
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {cls.defaultDurationMins} min
          </p>
          <p>{cls.nextStart ? `Next: ${formatShortDay(cls.nextStart, timeZone)}` : "No dates scheduled yet"}</p>
        </div>
        <p className="text-right text-lg font-bold text-foreground">
          {formatCurrency(price.priceCents)}
          <span className="block text-xs font-normal text-muted-foreground">{price.unit}</span>
        </p>
      </div>
    </Link>
  );
}
