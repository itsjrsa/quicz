"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ChartItem {
  text: string;
  count: number;
  isCorrect: boolean;
}

interface Props {
  data: ChartItem[];
  totalResponses: number;
}

export default function ResponseChart({ data, totalResponses }: Props) {
  return (
    <ResponsiveContainer width="100%" height={data.length * 52 + 20}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
      >
        <XAxis
          type="number"
          domain={[0, Math.max(totalResponses, 1)]}
          tickFormatter={(v) => String(v)}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          type="category"
          dataKey="text"
          width={120}
          tick={{ fontSize: 13, fontWeight: 500 }}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number) => [
            `${value} (${totalResponses > 0 ? Math.round((value / totalResponses) * 100) : 0}%)`,
            "Responses",
          ]}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill={entry.isCorrect ? "#16a34a" : "#e5e7eb"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
