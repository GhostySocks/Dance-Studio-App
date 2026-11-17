import { readFile } from "fs/promises";
import path from "path";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";

import { InvoicePDF, type PdfInvoice } from "@/components/pdf/invoice-pdf";

/** A file to go out with an email. */
export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

/** What an invoice from the database needs to have to be drawn as a PDF. */
export interface AttachableInvoice extends Omit<PdfInvoice, "periodStart" | "periodEnd" | "dueDate"> {
  periodStart: Date | string;
  periodEnd: Date | string;
  dueDate: Date | string | null;
}

const iso = (value: Date | string) => (typeof value === "string" ? value : value.toISOString());

let logo: Promise<string | undefined> | undefined;

/** The wide logo as a data address (read once), or nothing if the file is missing. */
function logoDataUri(): Promise<string | undefined> {
  logo ??= readFile(path.join(process.cwd(), "public", "images", "logo-horizontal.png"))
    .then((file) => `data:image/png;base64,${file.toString("base64")}`)
    .catch(() => undefined);
  return logo;
}

/**
 * Builds the same invoice PDF the Billing page downloads, on the server, so it
 * can be attached to an email.
 */
export async function buildInvoiceAttachment(
  invoice: AttachableInvoice,
  studio: { name: string; timezone: string }
): Promise<EmailAttachment> {
  // Loaded on demand: the PDF renderer is large and only needed when an invoice is emailed
  const [{ renderToBuffer }, logoSrc] = await Promise.all([import("@react-pdf/renderer"), logoDataUri()]);
  const content = await renderToBuffer(
    createElement(InvoicePDF, {
      invoice: {
        ...invoice,
        periodStart: iso(invoice.periodStart),
        periodEnd: iso(invoice.periodEnd),
        dueDate: invoice.dueDate ? iso(invoice.dueDate) : null,
      },
      studioName: studio.name,
      timeZone: studio.timezone,
      logoSrc,
      // InvoicePDF renders a <Document>; the renderer's types only accept one directly
    }) as unknown as ReactElement<DocumentProps>
  );
  return { filename: `invoice-${invoice.id.slice(-8).toUpperCase()}.pdf`, content };
}
