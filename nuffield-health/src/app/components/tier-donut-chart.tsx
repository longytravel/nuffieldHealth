"use client";

import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface TierDonutData {
  name: string;
  value: number;
  fill: string;
}

interface TierDonutChartProps {
  data: TierDonutData[];
  total: number;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: TierDonutData }>;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm shadow-lg">
      <span style={{ color: entry.payload.fill }}>{entry.name}</span>
      <span className="ml-2 text-[var(--text-primary)]">{entry.value.toLocaleString()}</span>
    </div>
  );
}

export function TierDonutChart({ data, total }: TierDonutChartProps) {
  const router = useRouter();

  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center">
        <p className="text-body text-[var(--text-muted)]">No tier data available</p>
      </div>
    );
  }

  function handleSegmentClick(tierName: string) {
    router.push(`/consultants?quality_tier=${encodeURIComponent(tierName)}`);
  }

  const srText = data.map((d) => `${d.name}: ${d.value}`).join(", ");

  return (
    <div className="relative" role="img" aria-label={`Quality tier distribution chart. ${srText}. Total: ${total} profiles`}>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={75}
            outerRadius={110}
            paddingAngle={3}
            dataKey="value"
            nameKey="name"
            animationBegin={0}
            animationDuration={800}
            animationEasing="ease-out"
            style={{ cursor: "pointer" }}
            onClick={(_data, index) => handleSegmentClick(data[index].name)}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} strokeWidth={0} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {/* Center label */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-kpi text-[var(--text-primary)]">{total.toLocaleString()}</span>
        <span className="text-caption text-[var(--text-muted)]">profiles</span>
      </div>
    </div>
  );
}
