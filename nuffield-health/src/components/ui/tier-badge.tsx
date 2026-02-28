import { cn } from "@/lib/utils";

type Tier = "gold" | "silver" | "bronze" | "incomplete";

interface TierBadgeProps {
  tier: Tier;
  className?: string;
}

const tierConfig: Record<Tier, { bg: string; text: string; label: string }> = {
  gold: {
    bg: "rgba(245, 158, 11, 0.15)",
    text: "var(--tier-gold)",
    label: "GOLD",
  },
  silver: {
    bg: "rgba(148, 163, 184, 0.15)",
    text: "var(--tier-silver)",
    label: "SILVER",
  },
  bronze: {
    bg: "rgba(217, 119, 6, 0.15)",
    text: "var(--tier-bronze)",
    label: "BRONZE",
  },
  incomplete: {
    bg: "rgba(239, 68, 68, 0.15)",
    text: "var(--tier-incomplete)",
    label: "INCOMPLETE",
  },
};

export function TierBadge({ tier, className }: TierBadgeProps) {
  const config = tierConfig[tier];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase",
        className
      )}
      style={{
        backgroundColor: config.bg,
        color: config.text,
      }}
    >
      {config.label}
    </span>
  );
}
