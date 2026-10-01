"use client"

import type { ReactNode } from "react"

import { StatCard, StatCardSkeleton } from "@workspace/ui/components/stat-card"

import { formatKpi } from "./kpi-value"
import type { Kpi } from "./types"

/**
 * The KPI row above a list (spec §22.4): the same cards as the dashboard.
 * Failing quietly is intended: the list still works without its figures.
 */
export function KpiStrip({
  kpis,
  loading,
  placeholders = 4,
  caption,
}: {
  kpis: Kpi[] | undefined
  loading: boolean
  placeholders?: number
  /** What the figures cover, when it is not obvious (e.g. live billing only). */
  caption?: ReactNode
}) {
  if (!loading && (kpis === undefined || kpis.length === 0)) return null
  // A CSS variable is not in CSSProperties; the intersection types it without a cast.
  const style: React.CSSProperties & { "--kpi-cols": number } = {
    "--kpi-cols": Math.min(kpis?.length ?? placeholders, 6),
  }

  return (
    <div className="flex flex-col gap-2">
      {caption ? (
        <p className="text-xs text-muted-foreground">{caption}</p>
      ) : null}
      <div
        className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-[repeat(var(--kpi-cols),minmax(0,1fr))]"
        style={style}
      >
        {loading || kpis === undefined
          ? Array.from({ length: placeholders }, (_, i) => (
              <StatCardSkeleton key={i} />
            ))
          : kpis.map((kpi) => (
              <StatCard
                key={`${kpi.key}:${kpi.currency_code ?? ""}`}
                label={kpi.label}
                value={formatKpi(kpi.value, kpi.format, kpi.currency_code)}
                estimated={kpi.is_estimated}
                supportingLabel={kpi.supporting_label}
                trend={
                  kpi.comparison
                    ? {
                        changePercent: kpi.comparison.change_percent,
                        direction: kpi.comparison.direction,
                        sentiment: kpi.comparison.sentiment,
                      }
                    : null
                }
              />
            ))}
      </div>
    </div>
  )
}
