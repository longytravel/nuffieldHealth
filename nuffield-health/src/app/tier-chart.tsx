"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { PieLabelRenderProps } from "recharts";

interface TierData {
  name: string;
  value: number;
  fill: string;
}

function renderLabel(props: PieLabelRenderProps) {
  const name = String(props.name ?? "");
  const percent = Number(props.percent ?? 0);
  return `${name} ${Math.round(percent * 100)}%`;
}

export function TierChart({ data }: { data: TierData[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          label={renderLabel}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
