"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export function SubscriberTrendChart({
  series,
}: {
  series: { date: string; free: number; pro: number; "pro plus": number }[];
}) {
  const data = series.map((s) => ({
    date: s.date.slice(5), // MM-DD
    free: s.free,
    pro: s.pro,
    "pro plus": s["pro plus"],
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-muted">
        No subscriber data yet
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "rgb(var(--muted))" }}
            interval={4}
            axisLine={{ stroke: "rgb(var(--border))" }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "rgb(var(--muted))" }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              background: "rgb(var(--surface))",
              border: "1px solid rgb(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="free"
            stroke="rgb(var(--muted))"
            strokeWidth={2}
            dot={false}
            name="Free"
          />
          <Line
            type="monotone"
            dataKey="pro"
            stroke="rgb(var(--success))"
            strokeWidth={2}
            dot={false}
            name="Pro"
          />
          <Line
            type="monotone"
            dataKey="pro plus"
            stroke="rgb(var(--accent))"
            strokeWidth={2}
            dot={false}
            name="Pro Plus"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
