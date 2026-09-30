import { formatMoney, formatNumber, formatPercent } from "@workspace/format"

import type { KpiFormat } from "./types"

/** Formats a KPI or chart value by its backend format (KpiValue::MONEY, COUNT, …). */
export function formatKpi(
  value: string | number | null,
  format: KpiFormat,
  currency: string | null
): string {
  if (value === null) return "—"

  switch (format) {
    case "money":
      return formatMoney(value, currency)
    case "percent":
      return formatPercent(value)
    case "duration_seconds": {
      const seconds = Number(value)
      if (!Number.isFinite(seconds)) return "—"
      if (seconds < 60) return `${Math.round(seconds)}s`
      if (seconds < 3600) return `${Math.round(seconds / 60)}m`
      return `${(seconds / 3600).toFixed(1)}h`
    }
    case "ratio":
      return formatNumber(value, { maximumFractionDigits: 2 })
    default:
      return formatNumber(value, { maximumFractionDigits: 0 })
  }
}
