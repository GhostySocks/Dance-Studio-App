"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type DomainColor = "people" | "classes" | "money" | "schedule" | "alert";

const domainStyles: Record<DomainColor, { border: string; iconBg: string; iconFg: string }> = {
  people: {
    border: "border-l-domain-people-icon",
    iconBg: "bg-domain-people",
    iconFg: "text-domain-people-icon",
  },
  classes: {
    border: "border-l-domain-classes-icon",
    iconBg: "bg-domain-classes",
    iconFg: "text-domain-classes-icon",
  },
  money: {
    border: "border-l-domain-money-icon",
    iconBg: "bg-domain-money",
    iconFg: "text-domain-money-icon",
  },
  schedule: {
    border: "border-l-domain-schedule-icon",
    iconBg: "bg-domain-schedule",
    iconFg: "text-domain-schedule-icon",
  },
  alert: {
    border: "border-l-domain-alert-icon",
    iconBg: "bg-domain-alert",
    iconFg: "text-domain-alert-icon",
  },
};

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  domain: DomainColor;
  className?: string;
}

export function StatCard({ title, value, subtitle, icon: Icon, domain, className }: StatCardProps) {
  const styles = domainStyles[domain];

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20, scale: 0.95 },
        visible: { opacity: 1, y: 0, scale: 1 },
      }}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm border border-border/50 border-l-[3.5px] transition-shadow hover:shadow-md",
        styles.border,
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className={cn("rounded-xl p-2.5", styles.iconBg)}>
          <Icon className={cn("h-5 w-5", styles.iconFg)} />
        </div>
      </div>
    </motion.div>
  );
}
