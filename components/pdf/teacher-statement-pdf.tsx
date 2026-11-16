"use client";

import { Document, Image as PdfImage, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { pdfLogoSrc } from "@/components/pdf/logo";
import type { TeacherReport } from "@/lib/db/teacher-report";
import type { PayBasis } from "@/lib/teacher-report";

/** The pay worked out on the report page. Left out when no rate was entered. */
export interface StatementPay {
  owedCents: number;
  /** How the amount was worked out, when a rate was used */
  basis?: PayBasis;
  rateCents?: number;
  /** Set once the payment has been recorded */
  paidOn?: string;
  reference?: string | null;
}

const BRAND = "#05668D";
const INK = "#1f2937";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const TINT = "#eef6f9";

const styles = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 60, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 9.5, color: INK },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  studio: { fontSize: 20, fontWeight: "bold", color: BRAND },
  logo: { height: 34, width: 163 },
  title: { fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 1.5 },
  rule: { height: 3, backgroundColor: BRAND, borderRadius: 2, marginTop: 10, marginBottom: 20 },
  meta: { flexDirection: "row", marginBottom: 20 },
  metaBlock: { flex: 1 },
  caption: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 },
  metaValue: { fontSize: 12, fontWeight: "bold" },
  tiles: { flexDirection: "row", marginBottom: 22 },
  tile: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 8, padding: 12, marginRight: 10 },
  tileLast: { marginRight: 0 },
  tilePay: { backgroundColor: BRAND, borderColor: BRAND },
  tileValue: { fontSize: 18, fontWeight: "bold" },
  tileNote: { fontSize: 8, color: MUTED, marginTop: 3 },
  onBrand: { color: "#ffffff" },
  onBrandMuted: { color: "#d7e9f0" },
  section: { fontSize: 11, fontWeight: "bold", marginBottom: 8 },
  headRow: { flexDirection: "row", backgroundColor: TINT, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 8 },
  headText: { fontSize: 8, fontWeight: "bold", color: BRAND, textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: LINE },
  totalRow: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 8, borderTopWidth: 1.5, borderTopColor: INK },
  bold: { fontWeight: "bold" },
  muted: { color: MUTED },
  small: { fontSize: 8, color: MUTED, marginTop: 1.5 },
  colDate: { width: 92 },
  colTime: { width: 104 },
  colClass: { flex: 1, paddingRight: 8 },
  colRoom: { width: 84, paddingRight: 8 },
  colLength: { width: 50, textAlign: "right" },
  colWho: { width: 130, paddingRight: 8 },
  calc: { flexDirection: "row", justifyContent: "flex-end", marginTop: 14 },
  calcBox: { width: 250, backgroundColor: TINT, borderRadius: 8, padding: 12 },
  calcLine: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  calcTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: BRAND,
  },
  calcTotalText: { fontSize: 13, fontWeight: "bold", color: BRAND },
  note: { fontSize: 8.5, color: MUTED, marginTop: 6, marginBottom: 8 },
  gap: { marginTop: 24 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: MUTED,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 8,
  },
});

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function hoursLabel(minutes: number) {
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

/**
 * A teacher's statement for a period: what they taught and, when a rate was
 * entered, how the pay was worked out. Made to be printed and handed over with
 * the check.
 */
export function TeacherStatementPDF({
  report,
  pay,
  studioName = "Dance Studio",
  logoSrc,
}: {
  report: TeacherReport;
  pay?: StatementPay | null;
  studioName?: string;
  /** Address of the wide logo (PNG); the studio name is written out without it */
  logoSrc?: string;
}) {
  const { timeZone, totals } = report;
  const date = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone }).format(new Date(iso));
  const time = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));
  const prepared = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone }).format(
    new Date()
  );
  const classWord = totals.classes === 1 ? "class" : "classes";
  const rate = pay?.basis && pay.rateCents ? { basis: pay.basis, cents: pay.rateCents } : null;

  return (
    <Document title={`${report.teacher.name} - ${pay ? "pay" : "teaching"} statement`} author={studioName}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          {logoSrc ? <PdfImage src={logoSrc} style={styles.logo} /> : <Text style={styles.studio}>{studioName}</Text>}
          <Text style={styles.title}>{pay ? "Pay statement" : "Teaching statement"}</Text>
        </View>
        <View style={styles.rule} />

        <View style={styles.meta}>
          <View style={styles.metaBlock}>
            <Text style={styles.caption}>{pay ? "Paid to" : "Teacher"}</Text>
            <Text style={styles.metaValue}>{report.teacher.name}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.caption}>Period</Text>
            <Text style={styles.metaValue}>
              {dayLabel(report.startDay)} – {dayLabel(report.endDay)}
            </Text>
          </View>
          <View style={{ width: 100 }}>
            <Text style={styles.caption}>{pay?.paidOn ? "Paid" : "Prepared"}</Text>
            <Text style={styles.metaValue}>{pay?.paidOn ? dayLabel(pay.paidOn) : prepared}</Text>
            {pay?.reference ? <Text style={styles.small}>{pay.reference}</Text> : null}
          </View>
        </View>

        <View style={styles.tiles}>
          <View style={styles.tile}>
            <Text style={styles.caption}>Classes taught</Text>
            <Text style={styles.tileValue}>{totals.classes}</Text>
            {totals.asSubstitute > 0 && <Text style={styles.tileNote}>{totals.asSubstitute} as a substitute</Text>}
          </View>
          <View style={pay ? styles.tile : [styles.tile, styles.tileLast]}>
            <Text style={styles.caption}>Time taught</Text>
            <Text style={styles.tileValue}>{hoursLabel(totals.minutes)}</Text>
            <Text style={styles.tileNote}>{totals.hours} hours</Text>
          </View>
          {pay && (
            <View style={[styles.tile, styles.tileLast, styles.tilePay]}>
              <Text style={[styles.caption, styles.onBrandMuted]}>Total pay</Text>
              <Text style={[styles.tileValue, styles.onBrand]}>{money(pay.owedCents)}</Text>
              {rate && (
                <Text style={[styles.tileNote, styles.onBrandMuted]}>
                  {money(rate.cents)} per {rate.basis === "PER_CLASS" ? "class" : "hour"}
                </Text>
              )}
            </View>
          )}
        </View>

        <Text style={styles.section}>Classes taught</Text>
        {report.classes.length === 0 ? (
          <Text style={styles.muted}>No classes taught in this period.</Text>
        ) : (
          <View>
            <View style={styles.headRow} fixed>
              <Text style={[styles.headText, styles.colDate]}>Date</Text>
              <Text style={[styles.headText, styles.colTime]}>Time</Text>
              <Text style={[styles.headText, styles.colClass]}>Class</Text>
              <Text style={[styles.headText, styles.colRoom]}>Room</Text>
              <Text style={[styles.headText, styles.colLength]}>Length</Text>
            </View>
            {report.classes.map((taught) => (
              <View key={taught.sessionId} style={styles.row} wrap={false}>
                <Text style={styles.colDate}>{date(taught.startTime)}</Text>
                <Text style={styles.colTime}>
                  {time(taught.startTime)} – {time(taught.endTime)}
                </Text>
                <View style={styles.colClass}>
                  <Text style={styles.bold}>{taught.className}</Text>
                  {taught.coveringFor && <Text style={styles.small}>Substitute for {taught.coveringFor}</Text>}
                </View>
                <Text style={styles.colRoom}>{taught.roomName}</Text>
                <Text style={styles.colLength}>{taught.minutes} min</Text>
              </View>
            ))}
            <View style={styles.totalRow} wrap={false}>
              <Text style={[styles.bold, { flex: 1 }]}>
                Total: {totals.classes} {classWord}
              </Text>
              <Text style={[styles.bold, { width: 90, textAlign: "right" }]}>{hoursLabel(totals.minutes)}</Text>
            </View>
          </View>
        )}

        {pay && (
          <View style={styles.calc} wrap={false}>
            <View style={styles.calcBox}>
              {rate && (
                <>
                  <View style={styles.calcLine}>
                    <Text style={styles.muted}>{rate.basis === "PER_CLASS" ? "Classes taught" : "Hours taught"}</Text>
                    <Text>{rate.basis === "PER_CLASS" ? totals.classes : totals.hours}</Text>
                  </View>
                  <View style={styles.calcLine}>
                    <Text style={styles.muted}>Rate per {rate.basis === "PER_CLASS" ? "class" : "hour"}</Text>
                    <Text>{money(rate.cents)}</Text>
                  </View>
                </>
              )}
              {pay.paidOn && (
                <View style={styles.calcLine}>
                  <Text style={styles.muted}>Paid</Text>
                  <Text>
                    {dayLabel(pay.paidOn)}
                    {pay.reference ? ` · ${pay.reference}` : ""}
                  </Text>
                </View>
              )}
              <View style={styles.calcTotal}>
                <Text style={styles.calcTotalText}>Total pay</Text>
                <Text style={styles.calcTotalText}>{money(pay.owedCents)}</Text>
              </View>
            </View>
          </View>
        )}

        {report.covered.length > 0 && (
          <View style={styles.gap} wrap={report.covered.length > 12}>
            <Text style={styles.section}>Taught by a substitute</Text>
            <Text style={[styles.note, { marginTop: -4 }]}>
              Classes someone else taught for {report.teacher.name} in this period. They are not counted above.
            </Text>
            <View style={styles.headRow}>
              <Text style={[styles.headText, styles.colDate]}>Date</Text>
              <Text style={[styles.headText, styles.colClass]}>Class</Text>
              <Text style={[styles.headText, styles.colWho]}>Taught by</Text>
              <Text style={[styles.headText, styles.colWho]}>Reason</Text>
            </View>
            {report.covered.map((covered) => (
              <View key={covered.sessionId} style={styles.row} wrap={false}>
                <Text style={styles.colDate}>{date(covered.startTime)}</Text>
                <Text style={styles.colClass}>{covered.className}</Text>
                <Text style={styles.colWho}>{covered.substituteName}</Text>
                <Text style={[styles.colWho, styles.muted]}>{covered.reason ?? ""}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>
            {studioName} · {report.teacher.name} · {dayLabel(report.startDay)} – {dayLabel(report.endDay)}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

/** Builds the statement and saves it as a PDF file. */
export async function downloadTeacherStatement(
  report: TeacherReport,
  pay: StatementPay | null,
  studioName?: string
): Promise<void> {
  // Loaded on demand: the PDF renderer is large and only needed here
  const { pdf } = await import("@react-pdf/renderer");
  const blob = await pdf(<TeacherStatementPDF report={report} pay={pay} studioName={studioName} logoSrc={pdfLogoSrc()} />).toBlob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const slug = report.teacher.name.replace(/\s+/g, "-").toLowerCase();
  link.download = `${pay ? "pay" : "teaching"}-statement-${slug}-${report.startDay}-to-${report.endDay}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
