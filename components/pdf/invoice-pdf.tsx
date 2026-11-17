// No "use client": the Billing page loads this in the browser (print-invoices.tsx)
// and the server draws it for email attachments (lib/invoice-attachment.ts).
import { Document, Image as PdfImage, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatDate } from "@/lib/utils";

// The same look as the teacher pay statement (teacher-statement-pdf.tsx)
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
  metaBlock: { flex: 1, paddingRight: 10 },
  caption: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 },
  metaValue: { fontSize: 12, fontWeight: "bold" },
  tiles: { flexDirection: "row", marginBottom: 22 },
  tile: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 8, padding: 12, marginRight: 10 },
  tileLast: { marginRight: 0 },
  tileTotal: { backgroundColor: BRAND, borderColor: BRAND },
  tileValue: { fontSize: 18, fontWeight: "bold" },
  tileNote: { fontSize: 8, color: MUTED, marginTop: 3 },
  onBrand: { color: "#ffffff" },
  onBrandMuted: { color: "#d7e9f0" },
  section: { fontSize: 11, fontWeight: "bold", marginBottom: 8 },
  headRow: { flexDirection: "row", backgroundColor: TINT, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 8 },
  headText: { fontSize: 8, fontWeight: "bold", color: BRAND, textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: LINE },
  bold: { fontWeight: "bold" },
  muted: { color: MUTED },
  colDesc: { flex: 1, paddingRight: 8 },
  colType: { width: 90, paddingRight: 8 },
  colAmount: { width: 80, textAlign: "right" },
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
  thanks: { fontSize: 8.5, color: MUTED, marginTop: 24 },
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

function formatMoney(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const amount = (Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}$${amount}`;
}

/** "TUITION" -> "Tuition" */
const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

interface InvoiceLineItem {
  id: string;
  description: string;
  amountCents: number;
  type: string;
}

export interface PdfInvoice {
  id: string;
  status: string;
  totalCents: number;
  periodStart: string;
  periodEnd: string;
  dueDate: string | null;
  lineItems: InvoiceLineItem[];
  student?: { firstName: string; lastName: string } | null;
  familyGroup?: { name: string } | null;
}

interface InvoicePDFProps {
  invoice: PdfInvoice;
  studioName?: string;
  /** Studio timezone, so the dates match the rest of the app. */
  timeZone?: string;
  /** Address of the wide logo (PNG); the studio name is written out without it */
  logoSrc?: string;
}

const DEFAULT_STUDIO = "Dance Studio";

/** What the highlighted tile says about the total, by invoice status. */
function totalCaption(status: string) {
  if (status === "PAID") return "Amount paid";
  if (status === "VOID") return "Total (void)";
  return "Amount due";
}

/** One invoice on its own page (US Letter). */
function InvoicePage({ invoice, studioName = DEFAULT_STUDIO, timeZone, logoSrc }: InvoicePDFProps) {
  const billTo = invoice.familyGroup
    ? invoice.familyGroup.name
    : invoice.student
      ? `${invoice.student.firstName} ${invoice.student.lastName}`
      : "Unknown";
  const number = invoice.id.slice(-8).toUpperCase();
  const charges = invoice.lineItems.filter((item) => item.amountCents >= 0).reduce((sum, item) => sum + item.amountCents, 0);
  const credits = invoice.lineItems.filter((item) => item.amountCents < 0).reduce((sum, item) => sum + item.amountCents, 0);
  const statusNote =
    invoice.status === "PAID"
      ? "Thank you"
      : invoice.status === "OVERDUE"
        ? "Payment is past due"
        : invoice.status === "VOID"
          ? "Nothing is owed"
          : invoice.status === "DRAFT"
            ? "Not yet sent"
            : "Awaiting payment";

  return (
    <Page size="LETTER" style={styles.page}>
      <View style={styles.header}>
        {logoSrc ? <PdfImage src={logoSrc} style={styles.logo} /> : <Text style={styles.studio}>{studioName}</Text>}
        <Text style={styles.title}>Invoice</Text>
      </View>
      <View style={styles.rule} />

      <View style={styles.meta}>
        <View style={styles.metaBlock}>
          <Text style={styles.caption}>Bill to</Text>
          <Text style={styles.metaValue}>{billTo}</Text>
        </View>
        <View style={styles.metaBlock}>
          <Text style={styles.caption}>Period</Text>
          <Text style={styles.metaValue}>
            {formatDate(invoice.periodStart, timeZone)} – {formatDate(invoice.periodEnd, timeZone)}
          </Text>
        </View>
        <View style={{ width: 100 }}>
          <Text style={styles.caption}>Due</Text>
          <Text style={styles.metaValue}>{invoice.dueDate ? formatDate(invoice.dueDate, timeZone) : "On receipt"}</Text>
        </View>
      </View>

      <View style={styles.tiles}>
        <View style={styles.tile}>
          <Text style={styles.caption}>Invoice number</Text>
          <Text style={styles.tileValue}>{number}</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.caption}>Status</Text>
          <Text style={styles.tileValue}>{titleCase(invoice.status)}</Text>
          <Text style={styles.tileNote}>{statusNote}</Text>
        </View>
        <View style={[styles.tile, styles.tileLast, styles.tileTotal]}>
          <Text style={[styles.caption, styles.onBrandMuted]}>{totalCaption(invoice.status)}</Text>
          <Text style={[styles.tileValue, styles.onBrand]}>{formatMoney(invoice.totalCents)}</Text>
          {invoice.dueDate && invoice.status !== "PAID" && invoice.status !== "VOID" && (
            <Text style={[styles.tileNote, styles.onBrandMuted]}>Due {formatDate(invoice.dueDate, timeZone)}</Text>
          )}
        </View>
      </View>

      <Text style={styles.section}>Charges</Text>
      {invoice.lineItems.length === 0 ? (
        <Text style={styles.muted}>Nothing has been charged on this invoice.</Text>
      ) : (
        <View>
          <View style={styles.headRow} fixed>
            <Text style={[styles.headText, styles.colDesc]}>Description</Text>
            <Text style={[styles.headText, styles.colType]}>Type</Text>
            <Text style={[styles.headText, styles.colAmount]}>Amount</Text>
          </View>
          {invoice.lineItems.map((item) => (
            <View key={item.id} style={styles.row} wrap={false}>
              <Text style={[styles.colDesc, styles.bold]}>{item.description}</Text>
              <Text style={[styles.colType, styles.muted]}>{titleCase(item.type)}</Text>
              <Text style={styles.colAmount}>{formatMoney(item.amountCents)}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.calc} wrap={false}>
        <View style={styles.calcBox}>
          {credits < 0 && (
            <>
              <View style={styles.calcLine}>
                <Text style={styles.muted}>Charges</Text>
                <Text>{formatMoney(charges)}</Text>
              </View>
              <View style={styles.calcLine}>
                <Text style={styles.muted}>Discounts and credits</Text>
                <Text>{formatMoney(credits)}</Text>
              </View>
            </>
          )}
          {invoice.dueDate && (
            <View style={styles.calcLine}>
              <Text style={styles.muted}>Due</Text>
              <Text>{formatDate(invoice.dueDate, timeZone)}</Text>
            </View>
          )}
          <View style={styles.calcTotal}>
            <Text style={styles.calcTotalText}>Total</Text>
            <Text style={styles.calcTotalText}>{formatMoney(invoice.totalCents)}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.thanks}>Thank you for dancing with {studioName}.</Text>

      <View style={styles.footer} fixed>
        <Text>
          {studioName} · Invoice {number} · {billTo}
        </Text>
        <Text>
          {formatDate(invoice.periodStart, timeZone)} – {formatDate(invoice.periodEnd, timeZone)}
        </Text>
      </View>
    </Page>
  );
}

export function InvoicePDF(props: InvoicePDFProps) {
  return (
    <Document title={`Invoice ${props.invoice.id.slice(-8).toUpperCase()}`} author={props.studioName ?? DEFAULT_STUDIO}>
      <InvoicePage {...props} />
    </Document>
  );
}

/** Several invoices in one document, a page each, for printing a batch. */
export function InvoicesPDF({
  invoices,
  studioName,
  timeZone,
  logoSrc,
}: {
  invoices: PdfInvoice[];
  studioName?: string;
  timeZone?: string;
  logoSrc?: string;
}) {
  return (
    <Document title="Invoices" author={studioName ?? DEFAULT_STUDIO}>
      {invoices.map((invoice) => (
        <InvoicePage key={invoice.id} invoice={invoice} studioName={studioName} timeZone={timeZone} logoSrc={logoSrc} />
      ))}
    </Document>
  );
}
