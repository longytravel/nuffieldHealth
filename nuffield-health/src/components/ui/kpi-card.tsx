import { type LucideIcon } from "lucide-react";
import Link from "next/link";
import { GlassCard } from "./glass-card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  delta?: number;
  href?: string;
  className?: string;
}

export function KpiCard({ icon: Icon, label, value, delta, href, className }: KpiCardProps) {
  const card = (
    <GlassCard className={cn("flex flex-col gap-3", href && "cursor-pointer", className)}>
      <div className="flex items-start justify-between">
        <Icon className="h-5 w-5 text-[var(--sensai-teal)]" aria-hidden="true" />
      </div>
      <div>
        <p className="text-caption text-[var(--text-secondary)]">{label}</p>
        <p className="text-kpi mt-1 text-[var(--text-primary)]">{value}</p>
      </div>
      {delta !== undefined && (
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              delta >= 0
                ? "bg-[var(--success)]/15 text-[var(--success)]"
                : "bg-[var(--danger)]/15 text-[var(--danger)]"
            )}
          >
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(1)}%
          </span>
        </div>
      )}
    </GlassCard>
  );

  if (href) {
    return <Link href={href} aria-label={`${label}: ${value}`}>{card}</Link>;
  }

  return card;
}
