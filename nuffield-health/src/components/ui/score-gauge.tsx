import { cn } from "@/lib/utils";

interface ScoreGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { svgSize: 64, strokeWidth: 5, fontSize: 14 },
  md: { svgSize: 96, strokeWidth: 6, fontSize: 20 },
  lg: { svgSize: 128, strokeWidth: 7, fontSize: 28 },
};

function getScoreColor(score: number): string {
  if (score >= 80) return "var(--tier-gold)";
  if (score >= 60) return "var(--tier-silver)";
  if (score >= 40) return "var(--tier-bronze)";
  return "var(--tier-incomplete)";
}

export function ScoreGauge({ score, size = "md", className }: ScoreGaugeProps) {
  const config = sizeMap[size];
  const center = config.svgSize / 2;
  const radius = center - config.strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.min(100, Math.max(0, score));
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;
  const color = getScoreColor(clampedScore);

  return (
    <div className={cn("flex flex-col items-center gap-1", className)} role="meter" aria-valuenow={clampedScore} aria-valuemin={0} aria-valuemax={100} aria-label={`Profile completeness score: ${clampedScore} out of 100`}>
      <svg
        aria-hidden="true"
        width={config.svgSize}
        height={config.svgSize}
        viewBox={`0 0 ${config.svgSize} ${config.svgSize}`}
        className="-rotate-90"
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--bg-elevated)"
          strokeWidth={config.strokeWidth}
        />
        {/* Score arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke-dashoffset 0.6s ease-in-out" }}
        />
        {/* Center text */}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--text-primary)"
          fontSize={config.fontSize}
          fontWeight={700}
          fontFamily="var(--font-jetbrains-mono), monospace"
          transform={`rotate(90 ${center} ${center})`}
        >
          {clampedScore}
        </text>
      </svg>
    </div>
  );
}
