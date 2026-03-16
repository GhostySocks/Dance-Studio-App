import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatDate(date: Date | string, timezone = "America/New_York"): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: timezone,
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string, timezone = "America/New_York"): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(date));
}
