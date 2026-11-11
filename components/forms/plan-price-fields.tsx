"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLAN_HINTS, PLAN_LABELS, TERM_PLANS, type TermPlan } from "@/lib/registration-billing";

/** Dollar strings while editing; "" means the plan is not offered. */
export type PlanPriceDraft = Record<TermPlan, string>;

export const emptyPlanPrices: PlanPriceDraft = { WEEKLY: "", MONTHLY: "", SEMESTER: "", ANNUAL: "" };

export function planPricesFromCents(prices: { plan: string; priceCents: number }[] = []): PlanPriceDraft {
  const draft = { ...emptyPlanPrices };
  for (const plan of TERM_PLANS) {
    const row = prices.find((p) => p.plan === plan);
    if (row) draft[plan] = (row.priceCents / 100).toFixed(2);
  }
  return draft;
}

/** Converts the draft to cents. Returns null if any entered price is not a valid amount. */
export function planPricesToCents(draft: PlanPriceDraft): Record<TermPlan, number | null> | null {
  const out = { WEEKLY: null, MONTHLY: null, SEMESTER: null, ANNUAL: null } as Record<TermPlan, number | null>;
  for (const plan of TERM_PLANS) {
    const raw = draft[plan].trim();
    if (raw === "") continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return null;
    out[plan] = Math.round(value * 100);
  }
  return out;
}

/**
 * Billing options for a class: whether single dates can be booked, and a price
 * for each term plan the studio wants to offer (blank = not offered).
 */
export function PlanPriceFields({
  dropInEnabled,
  onDropInChange,
  prices,
  onPricesChange,
}: {
  dropInEnabled: boolean;
  onDropInChange: (value: boolean) => void;
  prices: PlanPriceDraft;
  onPricesChange: (value: PlanPriceDraft) => void;
}) {
  return (
    <fieldset className="space-y-3 rounded-xl border border-border/60 p-4">
      <legend className="px-1 text-sm font-medium">Term billing options</legend>
      <p className="text-xs text-muted-foreground">
        Enter a price for each option families may choose when registering for a whole term. Leave
        one blank to not offer it.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {TERM_PLANS.map((plan) => (
          <div key={plan} className="space-y-1">
            <Label htmlFor={`plan-${plan}`}>{PLAN_LABELS[plan]} price ($)</Label>
            <Input
              id={`plan-${plan}`}
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="Not offered"
              aria-describedby={`plan-${plan}-hint`}
              value={prices[plan]}
              onChange={(e) => onPricesChange({ ...prices, [plan]: e.target.value })}
            />
            <p id={`plan-${plan}-hint`} className="text-xs text-muted-foreground">
              {PLAN_HINTS[plan]}
            </p>
          </div>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
          checked={dropInEnabled}
          onChange={(e) => onDropInChange(e.target.checked)}
        />
        Also allow booking single classes at the per-class price above
      </label>
    </fieldset>
  );
}
