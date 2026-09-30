"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@workspace/ui/components/chart"

import type { Chart } from "./types"

import { formatKpi } from "./kpi-value"

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

/** One chart block (ChartSeries) as an area chart; series are merged by their x value. */
export default function TrendChart({ chart }: { chart: Chart }) {
  const config: ChartConfig = Object.fromEntries(
    chart.series.map((s, i) => [
      s.key,
      { label: s.label, color: COLORS[i % COLORS.length] },
    ])
  )

  const byX = new Map<string, Record<string, string | number>>()
  for (const series of chart.series) {
    for (const point of series.points) {
      const row = byX.get(point.x) ?? { x: point.x }
      row[series.key] = Number(point.y)
      byX.set(point.x, row)
    }
  }
  const data = [...byX.values()]
  const total =
    chart.series[0]?.points.reduce((sum, p) => sum + Number(p.y), 0) ?? 0

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{chart.label}</CardTitle>
        <CardDescription>
          {formatKpi(total, chart.format, chart.currency_code)} in this period
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">
            No activity in this period yet.
          </p>
        ) : (
          <ChartContainer config={config} className="aspect-auto h-56 w-full">
            <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
              <defs>
                {chart.series.map((s) => (
                  <linearGradient
                    key={s.key}
                    id={`fill-${chart.key}-${s.key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={`var(--color-${s.key})`}
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="95%"
                      stopColor={`var(--color-${s.key})`}
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="x"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(v: number) =>
                  formatKpi(
                    v,
                    chart.format === "money" ? "count" : chart.format,
                    null
                  )
                }
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" />}
              />
              {chart.series.map((s) => (
                <Area
                  key={s.key}
                  dataKey={s.key}
                  type="monotone"
                  stroke={`var(--color-${s.key})`}
                  fill={`url(#fill-${chart.key}-${s.key})`}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
