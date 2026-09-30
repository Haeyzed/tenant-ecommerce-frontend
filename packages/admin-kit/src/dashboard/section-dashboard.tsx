"use client"

import { useQuery } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import type { ReactNode } from "react"

import { formatDateTime, formatMoney, formatNumber, formatPercent, type DisplaySettings } from "@workspace/format"
import { Alert, AlertTitle } from "@workspace/ui/components/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { StatCard, StatCardSkeleton } from "@workspace/ui/components/stat-card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Icon } from "@workspace/ui/icons"

import { ErrorState, StateView } from "../states"
import { formatKpi } from "./kpi-value"
import { RANGE_PRESETS, type RangePreset, type Section, type TableBlock } from "./types"

export type { RangePreset }

// Recharts is heavy and below the fold: load it only with a chart (spec §16.3 rule 7).
const TrendChart = dynamic(() => import("./trend-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-80 w-full rounded-xl" />,
})

const rangeValues = RANGE_PRESETS.map((r) => r.value)
const searchParams = {
  section: parseAsString,
  range: parseAsStringLiteral(rangeValues).withDefault("last_30_days"),
}

export type SectionSummary = { key: string; label: string }

/** Balanced KPI rows on wide screens: 6 → 3 + 3, 7–8 → 4 + 4, up to 5 in one row. */
function kpiColumns(count: number): number {
  if (count === 6) return 3
  if (count > 6) return 4
  return Math.max(count, 1)
}

/** TableBlock cell formats: text, count, quantity, money (currency_code on the row), percent, datetime, status. */
function cellValue(row: Record<string, unknown>, key: string, format: string, display: DisplaySettings | undefined): string {
  const value = row[key]
  if (value === null || value === undefined || value === "") return "—"

  switch (format) {
    case "money":
      return formatMoney(String(value), typeof row.currency_code === "string" ? row.currency_code : null)
    case "count":
      return formatNumber(String(value), { maximumFractionDigits: 0 })
    case "quantity":
      return formatNumber(String(value))
    case "percent":
      return formatPercent(String(value))
    case "datetime":
      return formatDateTime(String(value), display)
    case "status":
      return String(value).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
    default:
      return String(value)
  }
}

function BlockTable({ table, display }: { table: TableBlock; display: DisplaySettings | undefined }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{table.label}</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {table.rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing to show for this period.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {table.columns.map((c, i) => (
                  <TableHead key={c.key} className={i === 0 ? "ps-4 text-muted-foreground" : "text-end text-muted-foreground last:pe-4"}>
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.rows.map((row, r) => (
                <TableRow key={r}>
                  {table.columns.map((c, i) => (
                    <TableCell key={c.key} className={i === 0 ? "max-w-56 truncate ps-4 font-medium" : "text-end tabular-nums last:pe-4"}>
                      {cellValue(row, c.key, c.format, display)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * A section dashboard (spec §22.1): the backend's section list, one query
 * per section with a shared date range in the URL, KPIs, charts, top lists
 * and alerts. Used by tenant-admin and platform-admin with their own API.
 */
export function SectionDashboard({
  title,
  description,
  loadSections,
  loadSection,
  before,
  display,
}: {
  title: string
  description: string
  /** GET …/dashboard: the sections this user may see. */
  loadSections: (signal: AbortSignal) => Promise<SectionSummary[]>
  /** GET …/dashboard/{section}?range=… */
  loadSection: (key: string, range: RangePreset, signal: AbortSignal) => Promise<Section>
  /** Content between the header and the sections, e.g. the onboarding checklist. */
  before?: ReactNode
  display?: DisplaySettings
}) {
  const [params, setParams] = useQueryStates(searchParams)
  const sections = useQuery({
    queryKey: ["dashboard", "sections"],
    queryFn: ({ signal }) => loadSections(signal),
    staleTime: 5 * 60_000,
  })
  const active = params.section ?? sections.data?.[0]?.key ?? null
  // One query per section; refreshed every 5 minutes while visible (spec §14.3).
  const section = useQuery({
    queryKey: ["dashboard", "section", active, { range: params.range }],
    queryFn: ({ signal }) => loadSection(active ?? "", params.range, signal),
    enabled: active !== null,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  })
  const items = sections.data ?? []

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Select
            value={params.range}
            onValueChange={(value) => value && void setParams({ range: value as RangePreset })}
            items={RANGE_PRESETS.map((r) => ({ value: r.value, label: r.label }))}
          >
            <SelectTrigger aria-label="Date range" className="min-w-40">
              <Icon name="calendar" className="text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                {RANGE_PRESETS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        }
      />

      {before}

      {sections.isError ? (
        <ErrorState error={sections.error} onRetry={() => void sections.refetch()} />
      ) : sections.data && items.length === 0 ? (
        <StateView icon="dashboard" title="No dashboard for your role" description="Your role doesn't include any dashboard sections. Use the menu to get to your work." />
      ) : (
        <>
          {items.length > 1 ? (
            <>
              <Select
                value={active}
                onValueChange={(value) => value && void setParams({ section: String(value) })}
                items={items.map((s) => ({ value: s.key, label: s.label }))}
              >
                <SelectTrigger aria-label="Dashboard section" className="w-full sm:hidden">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {items.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Tabs value={active ?? undefined} onValueChange={(value) => void setParams({ section: String(value) })} className="hidden sm:flex">
                <div className="overflow-x-auto">
                  <TabsList>
                    {items.map((s) => (
                      <TabsTrigger key={s.key} value={s.key}>
                        {s.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              </Tabs>
            </>
          ) : null}

          {section.isError ? (
            <ErrorState error={section.error} onRetry={() => void section.refetch()} />
          ) : (
            <>
              {section.data && section.data.alerts.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {section.data.alerts.map((alert) => (
                    <Alert key={alert.key} variant={alert.severity === "critical" ? "destructive" : "default"}>
                      <Icon name={alert.severity === "critical" ? "error" : "alert"} />
                      <AlertTitle>{alert.message}</AlertTitle>
                    </Alert>
                  ))}
                </div>
              ) : null}

              <div
                className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-[repeat(var(--kpi-cols),minmax(0,1fr))]"
                style={{ "--kpi-cols": kpiColumns(section.data?.kpis.length ?? 4) } as React.CSSProperties}
              >
                {section.isPending
                  ? Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)
                  : section.data.kpis.map((kpi) => (
                      <StatCard
                        key={kpi.key}
                        label={kpi.label}
                        value={formatKpi(kpi.value, kpi.format, kpi.currency_code)}
                        estimated={kpi.is_estimated}
                        supportingLabel={kpi.supporting_label}
                        trend={
                          kpi.comparison
                            ? { changePercent: kpi.comparison.change_percent, direction: kpi.comparison.direction, sentiment: kpi.comparison.sentiment }
                            : null
                        }
                      />
                    ))}
              </div>

              {section.isPending ? (
                <Skeleton className="h-80 w-full rounded-xl" />
              ) : section.data.charts.length + section.data.tables.length > 0 ? (
                // Charts take two thirds and tables one third on wide screens, so one of each fills a row.
                <div className="grid grid-flow-row-dense gap-4 xl:grid-cols-3">
                  {section.data.charts.map((chart) => (
                    <div key={chart.key} className="min-w-0 xl:col-span-2">
                      <TrendChart chart={chart} />
                    </div>
                  ))}
                  {section.data.tables.map((table) => (
                    <div key={table.key} className="min-w-0">
                      <BlockTable table={table} display={display} />
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </>
      )}
    </>
  )
}
