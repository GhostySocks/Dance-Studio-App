"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency } from "@/lib/utils";

const axisTick = { fontSize: 12, fill: "hsl(var(--muted-foreground))" };
const gridStroke = "hsl(var(--border))";
const cursorFill = "hsl(var(--muted) / 0.5)";

function ChartTooltip({
  active,
  label,
  value,
}: {
  active?: boolean;
  label?: string;
  value?: string;
}) {
  if (!active || value === undefined) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

/** "2026-03" -> "Mar" (or "Mar 2026" when long). Parsed by hand to avoid timezone shifts. */
function formatMonth(month: string, long = false) {
  const [year, m] = month.split("-").map(Number);
  if (!year || !m) return month;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    ...(long ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, m - 1, 1)));
}

function formatCompactCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

/** Paid revenue per month. Single series, so one hue and no legend. */
export function RevenueBarChart({ data }: { data: { month: string; total: number }[] }) {
  return (
    <div
      className="h-64 w-full"
      role="img"
      aria-label={`Monthly revenue: ${data
        .map((d) => `${formatMonth(d.month, true)} ${formatCurrency(d.total)}`)
        .join(", ")}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={gridStroke} />
          <XAxis
            dataKey="month"
            tickFormatter={(m: string) => formatMonth(m)}
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: gridStroke }}
          />
          <YAxis
            tickFormatter={formatCompactCurrency}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            cursor={{ fill: cursorFill }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as { month: string; total: number } | undefined;
              return (
                <ChartTooltip
                  active={active}
                  label={row ? formatMonth(row.month, true) : undefined}
                  value={row ? formatCurrency(row.total) : undefined}
                />
              );
            }}
          />
          <Bar
            dataKey="total"
            fill="hsl(var(--domain-money-icon))"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** A count per category, largest first. Categories are named on the axis, so one hue. */
export function CategoryBarChart({
  data,
  unit,
  ariaLabel,
}: {
  data: { name: string; count: number }[];
  /** Noun for the tooltip, e.g. "enrollments". */
  unit: string;
  ariaLabel: string;
}) {
  const total = data.reduce((sum, d) => sum + d.count, 0) || 1;

  return (
    <div
      className="w-full"
      style={{ height: Math.max(data.length * 40 + 24, 120) }}
      role="img"
      aria-label={`${ariaLabel}: ${data.map((d) => `${d.name} ${d.count}`).join(", ")}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal={false} stroke={gridStroke} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ ...axisTick, fill: "hsl(var(--foreground))" }}
            tickLine={false}
            axisLine={{ stroke: gridStroke }}
            width={96}
          />
          <Tooltip
            cursor={{ fill: cursorFill }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as { name: string; count: number } | undefined;
              return (
                <ChartTooltip
                  active={active}
                  label={row?.name}
                  value={
                    row
                      ? `${row.count} ${unit} (${Math.round((row.count / total) * 100)}%)`
                      : undefined
                  }
                />
              );
            }}
          />
          <Bar
            dataKey="count"
            fill="hsl(var(--domain-classes-icon))"
            radius={[0, 4, 4, 0]}
            maxBarSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
