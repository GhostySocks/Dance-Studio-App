"use client";

import { useCallback, useEffect, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { RequiredMark } from "@/components/required-mark";
import { StyledSelect } from "@/components/styled-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TeacherReport } from "@/lib/db/teacher-report";
import { payOwedCents, type PayBasis } from "@/lib/teacher-report";
import { formatCurrency } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");
const toDay = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** First and last day of this month (offset 0) or an earlier one (offset -1 = last month). */
function monthRange(offset: number) {
  const now = new Date();
  return {
    start: toDay(new Date(now.getFullYear(), now.getMonth() + offset, 1)),
    end: toDay(new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)),
  };
}

function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * What a teacher taught in a period, for working out contractor pay. Admins pick
 * the teacher and can try a pay rate; a teacher sees their own classes.
 */
export function TeacherPayReport({ teachers }: { teachers?: { id: string; name: string }[] }) {
  const admin = teachers !== undefined;
  const [teacherId, setTeacherId] = useState("");
  const [start, setStart] = useState(() => monthRange(0).start);
  const [end, setEnd] = useState(() => monthRange(0).end);
  const [report, setReport] = useState<TeacherReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [basis, setBasis] = useState<PayBasis>("PER_CLASS");
  const [rate, setRate] = useState("");

  const ready = (!admin || teacherId !== "") && start !== "" && end !== "" && end >= start;

  const load = useCallback(async () => {
    if (!ready) {
      setReport(null);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ start, end });
      const url = admin ? `/api/teachers/${teacherId}/report?${params}` : `/api/teachers/me/report?${params}`;
      const res = await fetch(url);
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof json?.error === "string" ? json.error : "Failed to load the report");
      setReport(json.data);
    } catch (err: unknown) {
      setReport(null);
      toast.error(err instanceof Error ? err.message : "Failed to load the report");
    } finally {
      setLoading(false);
    }
  }, [admin, teacherId, start, end, ready]);

  useEffect(() => {
    load();
  }, [load]);

  const timeZone = report?.timeZone;
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone }).format(new Date(iso));
  const formatTime = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));

  const rateCents = Math.round(Number(rate) * 100);
  const owed = report ? payOwedCents(report.totals, basis, rateCents) : 0;

  function exportCsv() {
    if (!report) return;
    const rows: (string | number)[][] = [
      ["Teacher", report.teacher.name],
      ["Period", `${report.startDay} to ${report.endDay}`],
      [],
      ["Date", "Start", "End", "Class", "Room", "Minutes", "Enrolled", "Attended", "Substitute for"],
      ...report.classes.map((c) => [
        formatDate(c.startTime),
        formatTime(c.startTime),
        formatTime(c.endTime),
        c.className,
        c.roomName,
        c.minutes,
        c.enrolled,
        c.attended ?? "not submitted",
        c.coveringFor ?? "",
      ]),
      [],
      ["Classes taught", report.totals.classes],
      ["Hours taught", report.totals.hours],
      ["Of which as a substitute", report.totals.asSubstitute],
    ];
    if (report.covered.length > 0) {
      rows.push([], ["Own classes taught by a substitute (not counted above)"]);
      rows.push(["Date", "Start", "End", "Class", "Substitute", "Minutes", "Reason"]);
      for (const c of report.covered) {
        rows.push([
          formatDate(c.startTime),
          formatTime(c.startTime),
          formatTime(c.endTime),
          c.className,
          c.substituteName,
          c.minutes,
          c.reason ?? "",
        ]);
      }
    }
    if (admin && owed > 0) {
      rows.push([basis === "PER_CLASS" ? "Rate per class" : "Rate per hour", (rateCents / 100).toFixed(2)]);
      rows.push(["Pay owed", (owed / 100).toFixed(2)]);
    }
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `teacher-report-${report.teacher.name.replace(/\s+/g, "-").toLowerCase()}-${report.startDay}-to-${report.endDay}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={admin ? "Teacher Pay Report" : "My Teaching Report"}
        description={
          admin
            ? "Classes each teacher taught in a period, to work out what to pay them"
            : "The classes you taught in a period"
        }
      >
        <Button variant="outline" onClick={exportCsv} disabled={!report || report.classes.length === 0}>
          <FileDown className="mr-2 h-4 w-4" aria-hidden />
          Export CSV
        </Button>
      </PageHeader>

      <Card className="rounded-2xl border-0 shadow-md">
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          {admin && (
            <div className="grid w-64 gap-1.5">
              <Label>
                Teacher
                <RequiredMark />
              </Label>
              <StyledSelect
                value={teacherId}
                onChange={setTeacherId}
                options={(teachers ?? []).map((t) => ({ value: t.id, label: t.name }))}
                placeholder="Choose a teacher"
              />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="report-start">
              From
              <RequiredMark />
            </Label>
            <Input id="report-start" type="date" aria-required="true" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="report-end">
              To
              <RequiredMark />
            </Label>
            <Input id="report-end" type="date" aria-required="true" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {(
              [
                ["This month", 0],
                ["Last month", -1],
              ] as const
            ).map(([label, offset]) => (
              <Button
                key={label}
                variant="outline"
                size="sm"
                onClick={() => {
                  const range = monthRange(offset);
                  setStart(range.start);
                  setEnd(range.end);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
          {end !== "" && start !== "" && end < start && (
            <p className="basis-full text-xs text-destructive">The end date cannot be before the start date.</p>
          )}
        </CardContent>
      </Card>

      {loading && !report ? (
        <p className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading report…
        </p>
      ) : !report ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {admin && teacherId === "" ? "Choose a teacher to see their report." : "Choose a period to see the report."}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-2xl border-0 shadow-md">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Classes taught</p>
                <p className="text-3xl font-bold">{report.totals.classes}</p>
                {report.totals.asSubstitute > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {report.totals.asSubstitute} as a substitute
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-0 shadow-md">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Time taught</p>
                <p className="text-3xl font-bold">{formatHours(report.totals.minutes)}</p>
                <p className="text-xs text-muted-foreground">{report.totals.hours} hours</p>
              </CardContent>
            </Card>
            {admin && (
              <Card className="rounded-2xl border-0 shadow-md sm:col-span-2">
                <CardContent className="flex flex-wrap items-end gap-4 pt-6">
                  <div className="grid w-40 gap-1.5">
                    <Label>Pay</Label>
                    <StyledSelect
                      value={basis}
                      onChange={(value) => setBasis(value as PayBasis)}
                      options={[
                        { value: "PER_CLASS", label: "Per class" },
                        { value: "PER_HOUR", label: "Per hour" },
                      ]}
                      placeholder="Select..."
                    />
                  </div>
                  <div className="grid w-32 gap-1.5">
                    <Label htmlFor="report-rate">Rate ($)</Label>
                    <Input
                      id="report-rate"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="e.g. 40.00"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                    />
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-sm text-muted-foreground">Pay owed</p>
                    <p className="text-3xl font-bold" aria-live="polite">
                      {owed > 0 ? formatCurrency(owed) : "-"}
                    </p>
                  </div>
                  <p className="basis-full text-xs text-muted-foreground">
                    Enter a rate to work out the total. The rate is not saved, and nothing is paid through the app.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {report.totals.attendanceMissing > 0 && (
            <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Attendance has not been submitted for {report.totals.attendanceMissing} of these{" "}
              {report.totals.classes === 1 ? "class" : "classes"}. They are still counted as taught.
            </p>
          )}

          {report.totals.byClass.length > 1 && (
            <Card className="rounded-2xl border-0 shadow-md">
              <CardHeader>
                <CardTitle>By class</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y text-sm">
                  {report.totals.byClass.map((group) => (
                    <li key={group.className} className="flex justify-between gap-4 py-2">
                      <span className="font-medium">{group.className}</span>
                      <span className="text-muted-foreground">
                        {group.classes} {group.classes === 1 ? "class" : "classes"} · {formatHours(group.minutes)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-2xl border-0 shadow-md">
            <CardHeader>
              <CardTitle>
                {report.teacher.name}: classes taught
              </CardTitle>
            </CardHeader>
            <CardContent>
              {report.classes.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No classes taught in this period.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-left">
                      <tr>
                        <th scope="col" className="px-3 py-2 font-medium">Date</th>
                        <th scope="col" className="px-3 py-2 font-medium">Time</th>
                        <th scope="col" className="px-3 py-2 font-medium">Class</th>
                        <th scope="col" className="px-3 py-2 font-medium">Room</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Length</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Students</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.classes.map((taught) => (
                        <tr key={taught.sessionId} className="border-t">
                          <td className="whitespace-nowrap px-3 py-2">{formatDate(taught.startTime)}</td>
                          <td className="whitespace-nowrap px-3 py-2">
                            {formatTime(taught.startTime)} – {formatTime(taught.endTime)}
                          </td>
                          <td className="px-3 py-2 font-medium">
                            {taught.className}
                            {taught.coveringFor && (
                              <Badge variant="secondary" className="ml-2 font-normal">
                                Sub for {taught.coveringFor}
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-2">{taught.roomName}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right">{taught.minutes} min</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right">
                            {taught.attended === null
                              ? `${taught.enrolled} enrolled`
                              : `${taught.attended} of ${taught.enrolled} attended`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-semibold">
                        <td className="px-3 py-2" colSpan={4}>
                          Total: {report.totals.classes} {report.totals.classes === 1 ? "class" : "classes"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">{formatHours(report.totals.minutes)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {report.covered.length > 0 && (
            <Card className="rounded-2xl border-0 shadow-md">
              <CardHeader>
                <CardTitle>Taught by a substitute</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-muted-foreground">
                  {report.teacher.name}&apos;s own classes that someone else taught in this period. They are
                  not counted in the totals above; each one counts on the substitute&apos;s report.
                </p>
                <ul className="divide-y rounded-xl border text-sm">
                  {report.covered.map((covered) => (
                    <li key={covered.sessionId} className="flex flex-wrap justify-between gap-x-4 gap-y-1 px-3 py-2">
                      <span>
                        <span className="font-medium">{covered.className}</span>
                        <span className="text-muted-foreground">
                          {" · "}
                          {formatDate(covered.startTime)}, {formatTime(covered.startTime)}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        Taught by {covered.substituteName}
                        {covered.reason ? ` · ${covered.reason}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
