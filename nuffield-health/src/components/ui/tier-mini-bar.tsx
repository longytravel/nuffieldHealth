interface TierMiniBarProps {
  gold: number;
  silver: number;
  bronze: number;
  incomplete: number;
  className?: string;
}

export function TierMiniBar({
  gold,
  silver,
  bronze,
  incomplete,
  className,
}: TierMiniBarProps) {
  const total = gold + silver + bronze + incomplete;
  if (total === 0) return null;

  const segments = [
    { count: gold, color: "var(--tier-gold)", label: "Gold" },
    { count: silver, color: "var(--tier-silver)", label: "Silver" },
    { count: bronze, color: "var(--tier-bronze)", label: "Bronze" },
    { count: incomplete, color: "var(--tier-incomplete)", label: "Incomplete" },
  ].filter((s) => s.count > 0);

  const srText = segments.map((s) => `${s.label}: ${s.count}`).join(", ");

  return (
    <div className={className} role="img" aria-label={`Tier distribution - ${srText}`}>
      <div className="flex h-2 overflow-hidden rounded-full" aria-hidden="true">
        {segments.map((seg) => (
          <div
            key={seg.label}
            title={`${seg.label}: ${seg.count}`}
            style={{
              width: `${(seg.count / total) * 100}%`,
              backgroundColor: seg.color,
            }}
          />
        ))}
      </div>
    </div>
  );
}
