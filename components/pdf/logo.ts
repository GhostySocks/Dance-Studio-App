import { LOGOS } from "@/components/studio-logo";

/** Full address of the wide logo, for PDFs built in the browser. */
export function pdfLogoSrc(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}${LOGOS.horizontal.src}`;
}
