/**
 * Dashboard response overlay (spec §13.2): OpenAPI leaves these untyped
 * because the backend builds them through dynamic dispatch. Shapes follow
 * App\Shared\Metrics\{KpiValue, ChartSeries, TableBlock, Alert, SectionResult}.
 * @source App\Shared\Metrics\SectionResult
 */
export type KpiFormat =
  | "money"
  | "count"
  | "percent"
  | "duration_seconds"
  | "ratio"

export type Kpi = {
  key: string
  label: string
  value: string | number | null
  format: KpiFormat
  currency_code: string | null
  is_estimated: boolean
  comparison: {
    value: string | number | null
    from: string
    to: string
    change_percent: string | null
    direction: "up" | "down" | "flat"
    sentiment: "positive" | "negative" | "neutral"
  } | null
  supporting_label: string | null
  sparkline: { x: string; y: string | number }[] | null
}

export type Chart = {
  key: string
  label: string
  type: string
  format: KpiFormat
  currency_code: string | null
  interval: string
  series: {
    key: string
    label: string
    points: { x: string; y: string | number }[]
  }[]
}

export type TableBlock = {
  key: string
  label: string
  columns: { key: string; label: string; format: string }[]
  rows: Record<string, unknown>[]
  view_all_route: string | null
}

export type DashboardAlert = {
  key: string
  severity: "info" | "warning" | "critical" | string
  message: string
  count: number | null
  route: string | null
}

export type Section = {
  section: string
  range: { from: string; to: string; preset?: string | null }
  comparison_range: { from: string; to: string } | null
  kpis: Kpi[]
  charts: Chart[]
  tables: TableBlock[]
  alerts: DashboardAlert[]
}

export const RANGE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_quarter", label: "This quarter" },
  { value: "this_year", label: "This year" },
] as const

export type RangePreset = (typeof RANGE_PRESETS)[number]["value"]

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)
const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

/** Defensive normalisation at the boundary; unknown fields are dropped, missing lists become empty. */
export function normalizeSection(data: unknown): Section {
  const d = isRecord(data) ? data : {}
  const range = isRecord(d.range) ? d.range : {}

  return {
    section: typeof d.section === "string" ? d.section : "",
    range: {
      from: String(range.from ?? ""),
      to: String(range.to ?? ""),
      preset: typeof range.preset === "string" ? range.preset : null,
    },
    comparison_range: isRecord(d.comparison_range)
      ? {
          from: String(d.comparison_range.from ?? ""),
          to: String(d.comparison_range.to ?? ""),
        }
      : null,
    kpis: list<Kpi>(d.kpis),
    charts: list<Chart>(d.charts),
    tables: list<TableBlock>(d.tables),
    alerts: list<DashboardAlert>(d.alerts),
  }
}
