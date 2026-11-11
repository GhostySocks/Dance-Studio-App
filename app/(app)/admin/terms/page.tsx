"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { dayIn } from "@/lib/timezone";
import { termSchema, type TermFormData } from "@/lib/validations/term";
import { RequiredMark, RequiredNote } from "@/components/required-mark";

interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  _count: { terms: number; registrations: number };
}

interface Term {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  seasonId: string | null;
  season: { id: string; name: string } | null;
  _count: { registrations: number };
}

type Editing =
  | { kind: "term"; item: Term | null }
  | { kind: "season"; item: Season | null }
  | null;

type Deleting = { kind: "term" | "season"; id: string; name: string } | null;

function formatDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}

async function readError(res: Response, fallback: string) {
  const json = await res.json().catch(() => null);
  return typeof json?.error === "string" ? json.error : fallback;
}

function RangeForm({
  editing,
  seasons,
  timezone,
  onDone,
  onCancel,
}: {
  editing: NonNullable<Editing>;
  seasons: Season[];
  timezone: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { kind, item } = editing;
  const { register, handleSubmit, formState } = useForm<TermFormData>({
    resolver: zodResolver(termSchema),
    defaultValues: {
      name: item?.name ?? "",
      startDate: item ? dayIn(timezone, item.startDate) : "",
      endDate: item ? dayIn(timezone, item.endDate) : "",
      seasonId: kind === "term" ? (item?.seasonId ?? "") : "",
    },
  });
  const { errors, isSubmitting } = formState;

  async function onSubmit(values: TermFormData) {
    const base = kind === "term" ? "/api/terms" : "/api/seasons";
    const { seasonId, ...range } = values;
    try {
      const res = await fetch(item ? `${base}/${item.id}` : base, {
        method: item ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "term" ? { ...range, seasonId } : range),
      });
      if (!res.ok) {
        toast.error(await readError(res, "Could not save"));
        return;
      }
      toast.success(item ? "Saved" : kind === "term" ? "Term created" : "Season created");
      onDone();
    } catch {
      toast.error("Could not save. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <RequiredNote />
      <div className="space-y-2">
        <Label htmlFor="range-name">Name<RequiredMark /></Label>
        <Input
          id="range-name" aria-required="true"
          placeholder={kind === "term" ? "Fall 2026" : "2026–27 Season"}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "range-name-error" : undefined}
          {...register("name")}
        />
        {errors.name && (
          <p id="range-name-error" className="text-sm text-destructive">
            {errors.name.message}
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="range-start">First day<RequiredMark /></Label>
          <Input
            id="range-start" aria-required="true"
            type="date"
            aria-invalid={!!errors.startDate}
            aria-describedby={errors.startDate ? "range-start-error" : undefined}
            {...register("startDate")}
          />
          {errors.startDate && (
            <p id="range-start-error" className="text-sm text-destructive">
              {errors.startDate.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="range-end">Last day<RequiredMark /></Label>
          <Input
            id="range-end" aria-required="true"
            type="date"
            aria-invalid={!!errors.endDate}
            aria-describedby={errors.endDate ? "range-end-error" : undefined}
            {...register("endDate")}
          />
          {errors.endDate && (
            <p id="range-end-error" className="text-sm text-destructive">
              {errors.endDate.message}
            </p>
          )}
        </div>
      </div>
      {kind === "term" && (
        <div className="space-y-2">
          <Label htmlFor="range-season">Season (optional)</Label>
          <select
            id="range-season"
            aria-describedby="range-season-hint"
            className="h-8 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            {...register("seasonId")}
          >
            <option value="">None</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
          <p id="range-season-hint" className="text-sm text-muted-foreground">
            Annual registration is offered for terms that belong to a season.
          </p>
        </div>
      )}
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {isSubmitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

export default function AdminTermsPage() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [timezone, setTimezone] = useState("America/New_York");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<Deleting>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/terms");
      if (!res.ok) throw new Error("Failed");
      const { data } = await res.json();
      setTerms(data.terms);
      setSeasons(data.seasons);
      setTimezone(data.timezone);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/${deleting.kind === "term" ? "terms" : "seasons"}/${deleting.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(await readError(res, "Could not delete"));
      } else {
        toast.success(`${deleting.name} deleted`);
        load();
      }
      setDeleting(null);
    } catch {
      toast.error("Could not delete. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Terms" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Terms" />
        <p className="text-muted-foreground">Failed to load terms.</p>
      </div>
    );
  }

  const rowActions = (kind: "term" | "season", item: Term | Season) => (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Edit ${item.name}`}
        onClick={() =>
          setEditing(kind === "term" ? { kind, item: item as Term } : { kind, item: item as Season })
        }
      >
        <Pencil className="h-4 w-4" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Delete ${item.name}`}
        onClick={() => setDeleting({ kind, id: item.id, name: item.name })}
      >
        <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Terms"
        description="Semesters families can register for, and the seasons that group them"
      />

      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Terms (semesters)</CardTitle>
          <Button size="sm" onClick={() => setEditing({ kind: "term", item: null })}>
            <Plus className="h-4 w-4" aria-hidden />
            Add term
          </Button>
        </CardHeader>
        <CardContent>
          {terms.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No terms yet. Add one so families can register for a whole semester of a class.
            </p>
          ) : (
            <ul className="divide-y">
              {terms.map((term) => (
                <li key={term.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="text-sm font-semibold">{term.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDay(dayIn(timezone, term.startDate))} –{" "}
                      {formatDay(dayIn(timezone, term.endDate))}
                      {term.season ? ` · ${term.season.name}` : ""} · {term._count.registrations}{" "}
                      registration{term._count.registrations === 1 ? "" : "s"}
                    </p>
                  </div>
                  {rowActions("term", term)}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Seasons (years)</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setEditing({ kind: "season", item: null })}>
            <Plus className="h-4 w-4" aria-hidden />
            Add season
          </Button>
        </CardHeader>
        <CardContent>
          {seasons.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No seasons yet. A season (for example September to June) lets you offer an annual
              price that covers all of its terms.
            </p>
          ) : (
            <ul className="divide-y">
              {seasons.map((season) => (
                <li key={season.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="text-sm font-semibold">{season.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDay(dayIn(timezone, season.startDate))} –{" "}
                      {formatDay(dayIn(timezone, season.endDate))} · {season._count.terms} term
                      {season._count.terms === 1 ? "" : "s"}
                    </p>
                  </div>
                  {rowActions("season", season)}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={
          editing
            ? `${editing.item ? "Edit" : "Add"} ${editing.kind === "term" ? "term" : "season"}`
            : ""
        }
        description="Dates are calendar days in the studio's timezone."
        className="max-w-lg"
      >
        {editing && (
          <RangeForm
            key={`${editing.kind}-${editing.item?.id ?? "new"}`}
            editing={editing}
            seasons={seasons}
            timezone={timezone}
            onCancel={() => setEditing(null)}
            onDone={() => {
              setEditing(null);
              load();
            }}
          />
        )}
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? ""}?`}
        description="This cannot be undone. Class dates are not affected."
        className="max-w-sm"
      >
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => setDeleting(null)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onDelete} disabled={isDeleting}>
            {isDeleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
