import { describe, expect, it } from "vitest"

import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatMoney,
  formatPercent,
} from "./index"

const lagos = {
  date_format: "DD MMM YYYY",
  time_format: "12h",
  timezone: "Africa/Lagos",
}

describe("format", () => {
  it("formats dates in the tenant timezone and chosen format", () => {
    expect(formatDate("2026-09-30T23:30:00Z", lagos)).toBe("01 Oct 2026")
    expect(formatDateTime("2026-09-30T23:30:00Z", lagos)).toBe(
      "01 Oct 2026 12:30 AM"
    )
  })

  it("never shifts date-only values", () => {
    expect(
      formatDate("2026-01-05", { ...lagos, timezone: "Pacific/Kiritimati" })
    ).toBe("05 Jan 2026")
  })

  it("formats money from decimal strings without float loss", () => {
    expect(formatMoney("1234567890123.45", "USD", "en-US")).toBe(
      "$1,234,567,890,123.45"
    )
    expect(formatMoney(null, "USD")).toBe("—")
  })

  it("formats percentages and sizes", () => {
    expect(formatPercent("12.5", "en-US")).toBe("12.5%")
    expect(formatBytes(2_621_440)).toBe("2.5 MB")
  })
})
