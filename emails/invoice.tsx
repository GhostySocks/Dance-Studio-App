import { Button, Text } from "@react-email/components";
import { EmailLayout, styles } from "./components/layout";

export interface InvoiceEmailLine {
  id: string;
  description: string;
  amount: string;
}

export interface InvoiceEmailProps {
  studioName: string;
  /** "sent" = new invoice with pay link, "receipt" = payment received, "failed" = payment failed */
  kind: "sent" | "receipt" | "failed";
  billTo: string;
  period: string;
  dueDate: string | null;
  total: string;
  lines: InvoiceEmailLine[];
  payUrl: string;
}

const copy = {
  sent: {
    heading: "Your invoice is ready",
    intro: "A new invoice has been issued for your account.",
    totalLabel: "Amount due",
    cta: "View and pay invoice",
  },
  receipt: {
    heading: "Payment received — thank you",
    intro: "We've received your payment. This email is your receipt.",
    totalLabel: "Amount paid",
    cta: "View billing history",
  },
  failed: {
    heading: "Your payment didn't go through",
    intro:
      "We tried to process your payment but it was declined. No money was taken. Please try again with the same or a different card.",
    totalLabel: "Amount due",
    cta: "Try payment again",
  },
} as const;

export default function InvoiceEmail({
  studioName,
  kind,
  billTo,
  period,
  dueDate,
  total,
  lines,
  payUrl,
}: InvoiceEmailProps) {
  const c = copy[kind];
  return (
    <EmailLayout studioName={studioName} preview={`${c.heading} — ${total}`} heading={c.heading}>
      <Text style={styles.text}>{c.intro}</Text>
      <Text style={styles.muted}>
        Billed to {billTo} · {period}
        {kind !== "receipt" && dueDate ? ` · Due ${dueDate}` : ""}
      </Text>
      <table width="100%" cellPadding={0} cellSpacing={0}>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td style={styles.label}>{line.description}</td>
              <td style={styles.value}>{line.amount}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...styles.total, borderTop: "1px solid #e5e7eb" }}>{c.totalLabel}</td>
            <td style={{ ...styles.total, borderTop: "1px solid #e5e7eb", textAlign: "right" }}>
              {total}
            </td>
          </tr>
        </tbody>
      </table>
      <Text style={{ margin: "20px 0 0" }}>
        <Button href={payUrl} style={styles.button}>
          {c.cta}
        </Button>
      </Text>
    </EmailLayout>
  );
}
