"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SeriesPoint } from "@/lib/data/dashboard";

export function ExecutionsChart({
  data,
  title,
}: {
  data: SeriesPoint[];
  title: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="execGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand-1)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--brand-1)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="aprovGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand-2)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--brand-2)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--foreground)" }}
            />
            <Area
              type="monotone"
              dataKey="execucoes"
              name="Execuções"
              stroke="var(--brand-1)"
              strokeWidth={2}
              fill="url(#execGradient)"
              animationDuration={900}
            />
            <Area
              type="monotone"
              dataKey="aprovadas"
              name="Aprovadas"
              stroke="var(--brand-2)"
              strokeWidth={2}
              fill="url(#aprovGradient)"
              animationDuration={900}
              animationBegin={150}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
