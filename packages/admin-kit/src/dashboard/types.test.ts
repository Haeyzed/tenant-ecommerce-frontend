import { describe, expect, it } from "vitest"

import { normalizeSection } from "./types"

describe("normalizeSection", () => {
  it("keeps well-formed blocks", () => {
    const section = normalizeSection({
      section: "overview",
      range: { from: "2026-09-01", to: "2026-09-30", preset: "this_month" },
      kpis: [
        {
          key: "revenue",
          label: "Revenue",
          value: "1200.50",
          format: "money",
          currency_code: "USD",
          comparison: { value: "1000", from: "2026-08-01", to: "2026-08-31", change_percent: "20.05", direction: "up", sentiment: "positive" },
          sparkline: [{ x: "2026-09-01", y: 10 }],
        },
      ],
      charts: [{ key: "sales", label: "Sales", format: "money", series: [{ key: "total", label: "Total", points: [{ x: "2026-09-01", y: "5" }] }] }],
      tables: [{ key: "top", label: "Top", columns: [{ key: "name", label: "Name" }], rows: [{ name: "A" }] }],
      alerts: [{ key: "low_stock", severity: "warning", message: "3 items are low", count: 3 }],
    })

    expect(section.kpis[0]).toMatchObject({ key: "revenue", format: "money", comparison: { direction: "up", sentiment: "positive" } })
    expect(section.charts[0]?.series[0]?.points).toEqual([{ x: "2026-09-01", y: "5" }])
    expect(section.tables[0]?.columns[0]).toEqual({ key: "name", label: "Name", format: "text" })
    expect(section.alerts[0]?.count).toBe(3)
  })

  it("drops malformed items and defaults unknown values", () => {
    const section = normalizeSection({
      kpis: [null, "x", { label: "no key" }, { key: "orders", format: "weird", comparison: { direction: "sideways" } }],
      charts: [{ key: "c", series: [{ label: "no key" }, { key: "s", points: [{ x: 1 }, { x: "d", y: {} }] }] }],
      alerts: [{ key: "a" }],
    })

    expect(section.kpis).toHaveLength(1)
    expect(section.kpis[0]).toMatchObject({ key: "orders", label: "orders", format: "count", comparison: { direction: "flat", sentiment: "neutral" } })
    expect(section.charts[0]?.series).toEqual([{ key: "s", label: "s", points: [] }])
    expect(section.alerts).toEqual([])
    expect(section.tables).toEqual([])
  })
})
