"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, FileDown, FileText, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { TeacherPaymentForm } from "@/components/forms/teacher-payment-form";
import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/page-header";
import { RequiredMark } from "@/components/required-mark";
import { StyledSelect } from "@/components/styled-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TeacherPaymentRecord } from "@/lib/db/teacher-payments";
import type { TeacherReport } from "@/lib/db/teacher-report";
import { nextDay, payOwedCents, periodsOverlap, type PayBasis } from "@/lib/teacher-report";
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

/** A studio calendar day ("YYYY-MM-DD") written out, e.g. "Nov 1, 2026". */
function dayLabel(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, date))
  );
}
const periodLabel = (period: { startDay: string; endDay: string }) =>
  `${dayLabel(period.startDay)} – ${dayLabel(period.endDay)}`;

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The rate field's text as cents: null when empty, NaN when it is not a usable amount. */
function rateTextToCents(text: string): number | null {
  if (text.trim() === "") return null;
  const cents = Math.round(Number(text) * 100);
  return Number.isFinite(cents) && cents > 0 ? cents : NaN;
}

/** How long after the last change to the rate it is saved. */
const RATE_SAVE_DELAY_MS = 700;

/**
 * What a teacher taught in a period, for working out contractor pay. Admins pick
 * the teacher and set their pay rate, which is kept for that teacher until it is
 * changed; a teacher sees their own classes.
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
  const [payments, setPayments] = useState<TeacherPaymentRecord[]>([]);
  const [recording, setRecording] = useState(false);
  const [removing, setRemoving] = useState<TeacherPaymentRecord | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  /** The rate kept on the server for the chosen teacher (null while it is loading) */
  const [savedRate, setSavedRate] = useState<{ teacherId: string; basis: PayBasis; rate: string } | null>(null);
  const [rateStatus, setRateStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

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

  const loadPayments = useCallback(async () => {
    if (admin && teacherId === "") {
      setPayments([]);
      return;
    }
    try {
      const res = await fetch(admin ? `/api/teachers/${teacherId}/payments` : "/api/teachers/me/payments");
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof json?.error === "string" ? json.error : "Failed to load payments");
      setPayments(json.data);
    } catch (err: unknown) {
      setPayments([]);
      toast.error(err instanceof Error ? err.message : "Failed to load payments");
    }
  }, [admin, teacherId]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // The chosen teacher's own rate fills the fields
  useEffect(() => {
    if (!admin || teacherId === "") return;
    let cancelled = false;
    setSavedRate(null);
    setRate("");
    setRateStatus("idle");
    (async () => {
      try {
        const res = await fetch(`/api/teachers/${teacherId}/pay-rate`);
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(typeof json?.error === "string" ? json.error : "Failed to load the pay rate");
        if (cancelled) return;
        const kept: { basis: PayBasis; rateCents: number } | null = json.data.rate;
        const text = kept ? (kept.rateCents / 100).toFixed(2) : "";
        const keptBasis = kept?.basis ?? "PER_CLASS";
        setBasis(keptBasis);
        setRate(text);
        setSavedRate({ teacherId, basis: keptBasis, rate: text });
      } catch (err: unknown) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Failed to load the pay rate");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [admin, teacherId]);

  // A changed rate is saved for the teacher shortly after the last change
  useEffect(() => {
    if (!savedRate || savedRate.teacherId !== teacherId) return;
    const cents = rateTextToCents(rate);
    if (Number.isNaN(cents)) return;
    const savedCents = rateTextToCents(savedRate.rate);
    if (cents === savedCents && (cents === null || basis === savedRate.basis)) return;
    const timer = setTimeout(async () => {
      setRateStatus("saving");
      try {
        const res = await fetch(`/api/teachers/${teacherId}/pay-rate`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ basis, rateCents: cents }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(typeof json?.error === "string" ? json.error : "Could not save the pay rate");
        setSavedRate({ teacherId, basis, rate });
        setRateStatus("saved");
      } catch (err: unknown) {
        setRateStatus("error");
        toast.error(err instanceof Error ? err.message : "Could not save the pay rate");
      }
    }, RATE_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [savedRate, teacherId, basis, rate]);

  const timeZone = report?.timeZone;
  // Today as a studio calendar day (the browser's own day until the report has loaded)
  const today = timeZone
    ? new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
    : toDay(new Date());
  const selected = { startDay: start, endDay: end };
  /** The payment recorded for exactly this period, if there is one */
  const paid = payments.find((p) => p.startDay === start && p.endDay === end) ?? null;
  /** Payments that cover only some of these days: paying this period would pay those days twice */
  const clashes = paid ? [] : payments.filter((p) => periodsOverlap(p, selected));
  const notFinished = end > today;
  const lastPaidDay = payments.reduce((latest, p) => (p.endDay > latest ? p.endDay : latest), "");
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone }).format(new Date(iso));
  const formatTime = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));

  const rateCents = Math.round(Number(rate) * 100);
  const owed = report ? payOwedCents(report.totals, basis, rateCents) : 0;

  async function downloadPdf() {
    if (!report) return;
    setPdfBusy(true);
    try {
      const { downloadTeacherStatement } = await import("@/components/pdf/teacher-statement-pdf");
      const pay = paid
        ? {
            owedCents: paid.amountCents,
            basis: (paid.basis as PayBasis | null) ?? undefined,
            rateCents: paid.rateCents ?? undefined,
            paidOn: paid.paidOn,
            reference: paid.reference,
          }
        : admin && owed > 0
          ? { owedCents: owed, basis, rateCents }
          : null;
      await downloadTeacherStatement(report, pay, report.studioName);
    } catch {
      toast.error("Could not create the PDF");
    } finally {
      setPdfBusy(false);
    }
  }

  async function removePayment() {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      const res = await fetch(`/api/teachers/${teacherId}/payments/${removing.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof json?.error === "string" ? json.error : "Could not remove the payment");
      toast.success("Payment record removed");
      setRemoving(null);
      loadPayments();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not remove the payment");
    } finally {
      setRemoveBusy(false);
    }
  }

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
        <Button onClick={downloadPdf} disabled={!report || pdfBusy}>
          {pdfBusy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <FileText className="mr-2 h-4 w-4" aria-hidden />
          )}
          Download PDF
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
            {admin && lastPaidDay !== "" && lastPaidDay < today && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStart(nextDay(lastPaidDay));
                  setEnd(today);
                }}
              >
                Since last payment
              </Button>
            )}
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
          {paid && (
            <p className="flex items-start gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                This period was paid on {dayLabel(paid.paidOn)}: <strong>{formatCurrency(paid.amountCents)}</strong>
                {paid.reference ? ` (${paid.reference})` : ""}.
              </span>
            </p>
          )}
          {admin && clashes.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">Some of these days have already been paid.</p>
              <ul className="mt-1 list-disc pl-5">
                {clashes.map((clash) => (
                  <li key={clash.id}>
                    {periodLabel(clash)}: {formatCurrency(clash.amountCents)}, paid {dayLabel(clash.paidOn)}
                  </li>
                ))}
              </ul>
              <p className="mt-1">Change the dates so they do not overlap before paying for this period.</p>
            </div>
          )}

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
                      disabled={savedRate === null}
                      aria-describedby="report-rate-status"
                      onChange={(e) => {
                        setRate(e.target.value);
                        setRateStatus("idle");
                      }}
                    />
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-sm text-muted-foreground">Pay owed</p>
                    <p className="text-3xl font-bold" aria-live="polite">
                      {owed > 0 ? formatCurrency(owed) : "-"}
                    </p>
                  </div>
                  <p id="report-rate-status" aria-live="polite" className="basis-full text-xs text-muted-foreground">
                    {savedRate === null
                      ? "Loading the saved rate…"
                      : rateStatus === "saving"
                        ? "Saving the rate…"
                        : rateStatus === "error"
                          ? "The rate could not be saved. Change it again to retry."
                          : Number.isNaN(rateTextToCents(rate))
                            ? "Enter a rate above zero."
                            : rate !== savedRate.rate || (rate !== "" && basis !== savedRate.basis)
                              ? "Saving the rate…"
                              : savedRate.rate === ""
                                ? `No rate is saved for ${report.teacher.name} yet. Enter one and it is kept until you change it.`
                                : `${rateStatus === "saved" ? "Saved. " : ""}This is ${report.teacher.name}'s rate, and it stays until you change it here.`}
                  </p>
                  <p className="flex-1 basis-64 text-xs text-muted-foreground">
                    {paid
                      ? "A payment is already recorded for this period."
                      : clashes.length > 0
                        ? "Change the dates before recording a payment: some of these days are already paid."
                        : notFinished
                          ? `A payment cannot be recorded yet: this period runs to ${dayLabel(end)}, which has not passed. End it today or earlier.`
                          : "Nothing is paid through the app: record the payment once the check is written."}
                  </p>                  <Button
                    size="sm"
                    disabled={paid !== null || clashes.length > 0 || notFinished}
                    onClick={() => setRecording(true)}
                  >
                    Record payment
                  </Button>
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

      {(!admin || teacherId !== "") && (
        <Card className="rounded-2xl border-0 shadow-md">
          <CardHeader>
            <CardTitle>Payment history</CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {admin ? "No payments recorded for this teacher yet." : "No payments have been recorded yet."}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Period</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Classes</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Time</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Amount</th>
                      <th scope="col" className="px-3 py-2 font-medium">Paid on</th>
                      <th scope="col" className="px-3 py-2 font-medium">Reference</th>
                      {admin && (
                        <th scope="col" className="px-3 py-2">
                          <span className="sr-only">Actions</span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id} className="border-t">
                        <td className="whitespace-nowrap px-3 py-2">
                          <button
                            type="button"
                            className="font-medium text-primary hover:underline"
                            title="Show this period"
                            onClick={() => {
                              setStart(payment.startDay);
                              setEnd(payment.endDay);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                          >
                            {periodLabel(payment)}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-right">{payment.classes}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">{formatHours(payment.minutes)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-medium">
                          {formatCurrency(payment.amountCents)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">{dayLabel(payment.paidOn)}</td>
                        <td className="px-3 py-2">
                          {payment.reference ?? ""}
                          {payment.note && <span className="block text-xs text-muted-foreground">{payment.note}</span>}
                        </td>
                        {admin && (
                          <td className="px-3 py-2 text-right">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Remove the payment for ${periodLabel(payment)}`}
                              title="Remove"
                              onClick={() => setRemoving(payment)}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Choose a period to see its classes and download its statement.
              {admin ? " Paid periods cannot overlap, so no class is paid twice." : ""}
            </p>
          </CardContent>
        </Card>
      )}

      <Modal
        open={recording && report !== null}
        onClose={() => setRecording(false)}
        title="Record a payment"
        description={
          report
            ? `${report.teacher.name} · ${periodLabel(selected)} · ${report.totals.classes} ${
                report.totals.classes === 1 ? "class" : "classes"
              }, ${formatHours(report.totals.minutes)}`
            : undefined
        }
      >
        <TeacherPaymentForm
          teacherId={teacherId}
          start={start}
          end={end}
          owedCents={owed}
          basis={basis}
          rateCents={rateCents}
          today={today}
          onCancel={() => setRecording(false)}
          onRecorded={() => {
            setRecording(false);
            loadPayments();
          }}
        />
      </Modal>

      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="Remove this payment record?"
        description={
          removing
            ? `${periodLabel(removing)} · ${formatCurrency(removing.amountCents)}, paid ${dayLabel(removing.paidOn)}`
            : undefined
        }
      >
        <p className="text-sm text-muted-foreground">
          Only do this if the payment was entered by mistake. The period will count as unpaid again.
        </p>
        <div className="mt-4 flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => setRemoving(null)} disabled={removeBusy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={removePayment} disabled={removeBusy}>
            {removeBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            Remove record
          </Button>
        </div>
      </Modal>
    </div>
  );
}
