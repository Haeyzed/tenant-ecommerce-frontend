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

/**
 * The backend's range presets (App\Shared\Metrics\DateRange::PRESETS).
 * "Last 7/30 days" are complete days: they end yesterday. "This …" presets
 * run up to now and include today.
 */
export const RANGE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_quarter", label: "This quarter" },
  { value: "this_year", label: "This year" },
  { value: "last_year", label: "Last year" },
] as const

export type RangePreset = (typeof RANGE_PRESETS)[number]["value"]

export const COMPARE_OPTIONS = [
  { value: "previous_period", label: "vs previous period" },
  { value: "previous_year", label: "vs same period last year" },
  { value: "none", label: "No comparison" },
] as const

export type CompareOption = (typeof COMPARE_OPTIONS)[number]["value"]

/** A custom range spans at most this many days (DateRange::MAX_CUSTOM_DAYS). */
export const MAX_CUSTOM_DAYS = 731

/**
 * The dashboard's date query, sent as-is to GET …/dashboard/{section}:
 * a preset, or `custom` with `from`/`to` (Y-m-d, in the business timezone).
 */
export type DashboardQuery =
  | { range: RangePreset; compare: CompareOption }
  | { range: "custom"; from: string; to: string; compare: CompareOption }

/** GET …/dashboard: the sections this user may see. */
export function normalizeSections(data: unknown): { key: string; label: string }[] {
  const sections = isRecord(data) && Array.isArray(data.sections) ? data.sections : []
  return sections.flatMap((s) => (isRecord(s) && typeof s.key === "string" ? [{ key: s.key, label: str(s.label, s.key) }] : []))
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback)
const optStr = (v: unknown): string | null => (typeof v === "string" ? v : null)
const scalar = (v: unknown): string | number | null => (typeof v === "string" || typeof v === "number" ? v : null)
const FORMATS: readonly KpiFormat[] = ["money", "count", "percent", "duration_seconds", "ratio"]
const format = (v: unknown): KpiFormat => FORMATS.find((f) => f === v) ?? "count"

/** Parses each item and drops the ones that are not the expected shape. */
function list<T>(v: unknown, parse: (item: Record<string, unknown>) => T | null): T[] {
  return (Array.isArray(v) ? v : []).flatMap((item) => {
    const parsed = isRecord(item) ? parse(item) : null
    return parsed === null ? [] : [parsed]
  })
}

const point = (p: Record<string, unknown>) => {
  const y = scalar(p.y)
  return typeof p.x === "string" && y !== null ? { x: p.x, y } : null
}

function kpi(k: Record<string, unknown>): Kpi | null {
  if (typeof k.key !== "string") return null
  const c = isRecord(k.comparison) ? k.comparison : null
  const direction = c?.direction === "up" || c?.direction === "down" ? c.direction : "flat"
  const sentiment = c?.sentiment === "positive" || c?.sentiment === "negative" ? c.sentiment : "neutral"
  return {
    key: k.key,
    label: str(k.label, k.key),
    value: scalar(k.value),
    format: format(k.format),
    currency_code: optStr(k.currency_code),
    is_estimated: k.is_estimated === true,
    comparison: c
      ? { value: scalar(c.value), from: str(c.from), to: str(c.to), change_percent: optStr(c.change_percent), direction, sentiment }
      : null,
    supporting_label: optStr(k.supporting_label),
    sparkline: Array.isArray(k.sparkline) ? list(k.sparkline, point) : null,
  }
}

function chart(c: Record<string, unknown>): Chart | null {
  if (typeof c.key !== "string") return null
  return {
    key: c.key,
    label: str(c.label, c.key),
    type: str(c.type, "line"),
    format: format(c.format),
    currency_code: optStr(c.currency_code),
    interval: str(c.interval),
    series: list(c.series, (s) => (typeof s.key === "string" ? { key: s.key, label: str(s.label, s.key), points: list(s.points, point) } : null)),
  }
}

function tableBlock(t: Record<string, unknown>): TableBlock | null {
  if (typeof t.key !== "string") return null
  return {
    key: t.key,
    label: str(t.label, t.key),
    columns: list(t.columns, (col) => (typeof col.key === "string" ? { key: col.key, label: str(col.label, col.key), format: str(col.format, "text") } : null)),
    rows: list(t.rows, (row) => row),
    view_all_route: optStr(t.view_all_route),
  }
}

function alert(a: Record<string, unknown>): DashboardAlert | null {
  if (typeof a.key !== "string" || typeof a.message !== "string") return null
  return { key: a.key, severity: str(a.severity, "info"), message: a.message, count: typeof a.count === "number" ? a.count : null, route: optStr(a.route) }
}

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
    kpis: list(d.kpis, kpi),
    charts: list(d.charts, chart),
    tables: list(d.tables, tableBlock),
    alerts: list(d.alerts, alert),
  }
}
