"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10 },
  header: { marginBottom: 30 },
  studioName: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  invoiceTitle: { fontSize: 14, color: "#666", marginBottom: 20 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { color: "#666" },
  value: { fontWeight: "bold" },
  divider: { borderBottomWidth: 1, borderBottomColor: "#e5e5e5", marginVertical: 12 },
  table: { marginTop: 20 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    paddingBottom: 6,
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  colDesc: { flex: 1 },
  colType: { width: 80, textAlign: "center" },
  colAmount: { width: 80, textAlign: "right" },
  headerText: { fontWeight: "bold", fontSize: 9, textTransform: "uppercase", color: "#666" },
  totalRow: {
    flexDirection: "row",
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: "#333",
  },
  totalLabel: { flex: 1, fontWeight: "bold", fontSize: 12 },
  totalAmount: { width: 80, textAlign: "right", fontWeight: "bold", fontSize: 12 },
  footer: { position: "absolute", bottom: 40, left: 40, right: 40, fontSize: 8, color: "#999", textAlign: "center" },
  statusBadge: { fontSize: 10, padding: "2 8", borderRadius: 4 },
});

function formatMoney(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toFixed(2)}`;
}

interface InvoiceLineItem {
  id: string;
  description: string;
  amountCents: number;
  type: string;
}

interface InvoicePDFProps {
  invoice: {
    id: string;
    status: string;
    totalCents: number;
    periodStart: string;
    periodEnd: string;
    dueDate: string | null;
    lineItems: InvoiceLineItem[];
    student?: { firstName: string; lastName: string } | null;
    familyGroup?: { name: string } | null;
  };
  studioName?: string;
}

export function InvoicePDF({ invoice, studioName = "Rhythm & Grace Dance Academy" }: InvoicePDFProps) {
  const billTo = invoice.familyGroup
    ? invoice.familyGroup.name
    : invoice.student
      ? `${invoice.student.firstName} ${invoice.student.lastName}`
      : "Unknown";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.studioName}>{studioName}</Text>
          <Text style={styles.invoiceTitle}>INVOICE</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Invoice #:</Text>
          <Text style={styles.value}>{invoice.id.slice(-8).toUpperCase()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Status:</Text>
          <Text style={styles.value}>{invoice.status}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Bill To:</Text>
          <Text style={styles.value}>{billTo}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Period:</Text>
          <Text style={styles.value}>
            {new Date(invoice.periodStart).toLocaleDateString()} –{" "}
            {new Date(invoice.periodEnd).toLocaleDateString()}
          </Text>
        </View>
        {invoice.dueDate && (
          <View style={styles.row}>
            <Text style={styles.label}>Due Date:</Text>
            <Text style={styles.value}>
              {new Date(invoice.dueDate).toLocaleDateString()}
            </Text>
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.colDesc]}>Description</Text>
            <Text style={[styles.headerText, styles.colType]}>Type</Text>
            <Text style={[styles.headerText, styles.colAmount]}>Amount</Text>
          </View>
          {invoice.lineItems.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colType}>{item.type}</Text>
              <Text style={styles.colAmount}>{formatMoney(item.amountCents)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>{formatMoney(invoice.totalCents)}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Thank you for your business! — {studioName}
        </Text>
      </Page>
    </Document>
  );
}
