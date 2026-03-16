"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, MapPin, User } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

interface ScheduleEntry {
  id: string;
  student: { firstName: string; lastName: string };
  session: {
    startTime: string;
    endTime: string;
    template: { name: string; danceStyle: string | null };
    teacher: { user: { name: string | null } } | null;
    room: { name: string } | null;
  };
}

export default function ParentSchedulePage() {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSchedule() {
      try {
        const res = await fetch("/api/parent/schedule");
        if (!res.ok) throw new Error("Failed");
        const json = await res.json();
        setEntries(json.data || []);
      } catch {
        toast.error("Failed to load schedule");
      } finally {
        setLoading(false);
      }
    }
    fetchSchedule();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Group by date
  const grouped: Record<string, ScheduleEntry[]> = {};
  for (const entry of entries) {
    const dateKey = new Date(entry.session.startTime).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(entry);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        description="Upcoming classes for your children"
      />

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No upcoming classes.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, dateEntries]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">{date}</h3>
              <div className="space-y-2">
                {dateEntries.map((entry) => {
                  const start = new Date(entry.session.startTime);
                  const end = new Date(entry.session.endTime);
                  return (
                    <Card key={entry.id}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <p className="font-medium">{entry.session.template.name}</p>
                            <p className="text-xs text-muted-foreground">
                              for {entry.student.firstName} {entry.student.lastName}
                            </p>
                            <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                                {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              {entry.session.teacher?.user.name && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {entry.session.teacher.user.name}
                                </span>
                              )}
                              {entry.session.room?.name && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {entry.session.room.name}
                                </span>
                              )}
                            </div>
                          </div>
                          {entry.session.template.danceStyle && (
                            <Badge variant="secondary">
                              {entry.session.template.danceStyle}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
