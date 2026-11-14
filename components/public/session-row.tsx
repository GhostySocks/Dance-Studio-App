import Link from "next/link";
import { Clock, MapPin, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/link-button";
import type { PublicSession } from "@/lib/db/public";
import { formatShortDay, formatTimeRange, spotsLabel } from "@/lib/schedule-format";
import { cn } from "@/lib/utils";

/** One upcoming session with its register button. Shared by the schedule and class pages. */
export function SessionRow({
  session,
  timeZone,
  showClass = true,
  showDay = false,
}: {
  session: PublicSession;
  timeZone: string;
  showClass?: boolean;
  showDay?: boolean;
}) {
  const full = session.spotsLeft <= 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
      <div className="min-w-0 space-y-1.5">
        {showClass && (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/classes/${session.template.id}`}
              className="font-semibold text-foreground underline-offset-4 hover:underline"
            >
              {session.template.name}
            </Link>
            {session.template.danceStyle && (
              <Badge className="bg-domain-classes text-domain-classes-foreground">
                {session.template.danceStyle}
              </Badge>
            )}
            {session.template.skillLevel && (
              <Badge variant="outline">{session.template.skillLevel}</Badge>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {showDay && <span className="font-medium text-foreground">{formatShortDay(session.startTime, timeZone)},</span>}
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
      </div>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "text-sm font-medium",
            full
              ? "text-domain-alert-foreground"
              : session.spotsLeft <= 3
                ? "text-domain-money-foreground"
                : "text-muted-foreground"
          )}
        >
          {spotsLabel(session.spotsLeft)}
        </span>
        {session.template.dropInEnabled ? (
          <LinkButton
            href={`/register?session=${session.id}`}
            variant={full ? "outline" : "cta"}
            className="h-9 px-4"
          >
            {full ? "Join waitlist" : "Register"}
          </LinkButton>
        ) : (
          <LinkButton href={`/classes/${session.template.id}#register`} variant="cta" className="h-9 px-4">
            Register for term
          </LinkButton>
        )}
      </div>
    </div>
  );
}
