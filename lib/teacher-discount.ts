/**
 * The studio's discount for teachers on the classes they take (Settings →
 * Teacher discount). PERCENT is a whole percentage of the invoice's charges;
 * FIXED is an amount in cents taken off each invoice.
 */
export interface TeacherDiscount {
  type: "PERCENT" | "FIXED";
  value: number;
}

/** Reads the stored columns; anything incomplete or out of range means no discount. */
export function toTeacherDiscount(type: string | null | undefined, value: number | null | undefined): TeacherDiscount | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) return null;
  if (type === "PERCENT") return value <= 100 ? { type, value } : null;
  if (type === "FIXED") return { type, value };
  return null;
}

/** How much the discount takes off a total (never more than the total). */
export function teacherDiscountCents(discount: TeacherDiscount, totalCents: number): number {
  if (totalCents <= 0) return 0;
  const off = discount.type === "PERCENT" ? Math.round(totalCents * (discount.value / 100)) : discount.value;
  return Math.min(off, totalCents);
}

/** The discount as it reads on an invoice line. */
export function teacherDiscountLabel(discount: TeacherDiscount): string {
  return discount.type === "PERCENT" ? `Teacher discount (${discount.value}%)` : "Teacher discount";
}
