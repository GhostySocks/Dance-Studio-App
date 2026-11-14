"use client";

import type { PdfInvoice } from "@/components/pdf/invoice-pdf";

const FRAME_ID = "invoice-print-frame";
let lastUrl: string | null = null;

/**
 * Builds one PDF with a page per invoice and opens the browser's print dialog
 * for it. If the browser will not print a PDF from the page, the PDF opens in a
 * new tab instead so it can be printed from there.
 */
export async function printInvoices(
  invoices: PdfInvoice[],
  studio: { name?: string; timezone?: string }
): Promise<void> {
  // Loaded on demand: the PDF renderer is large and only needed here
  const [{ pdf }, { InvoicesPDF }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/pdf/invoice-pdf"),
  ]);
  const blob = await pdf(
    <InvoicesPDF invoices={invoices} studioName={studio.name} timeZone={studio.timezone} />
  ).toBlob();

  // Clear up the previous print job (it cannot be removed while its dialog is open)
  document.getElementById(FRAME_ID)?.remove();
  if (lastUrl) URL.revokeObjectURL(lastUrl);

  const url = URL.createObjectURL(blob);
  lastUrl = url;

  const frame = document.createElement("iframe");
  frame.id = FRAME_ID;
  frame.title = "Invoices to print";
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  frame.onload = () => {
    try {
      const target = frame.contentWindow;
      if (!target) throw new Error("No print window");
      target.focus();
      target.print();
    } catch {
      window.open(url, "_blank", "noopener");
    }
  };
  frame.src = url;
  document.body.appendChild(frame);
}

/** Builds the PDF for one invoice and saves it as a file. */
export async function downloadInvoice(
  invoice: PdfInvoice,
  studio: { name?: string; timezone?: string }
): Promise<void> {
  const [{ pdf }, { InvoicePDF }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/pdf/invoice-pdf"),
  ]);
  const blob = await pdf(
    <InvoicePDF invoice={invoice} studioName={studio.name} timeZone={studio.timezone} />
  ).toBlob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `invoice-${invoice.id.slice(-8)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
