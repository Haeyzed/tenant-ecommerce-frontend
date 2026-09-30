import { TZDate } from "@date-fns/tz"
import { format as formatWithPattern, formatDistanceToNowStrict } from "date-fns"

/** The display settings every `me` response carries (backend DisplayPreferences). */
export type DisplaySettings = {
  date_format: string
  time_format: string
  timezone: string
}

/** Backend date formats (DisplayFormat) mapped to date-fns patterns. */
const DATE_PATTERNS: Record<string, string> = {
  "DD/MM/YYYY": "dd/MM/yyyy",
  "MM/DD/YYYY": "MM/dd/yyyy",
  "YYYY-MM-DD": "yyyy-MM-dd",
  "DD MMM YYYY": "dd MMM yyyy",
  "MMM DD, YYYY": "MMM dd, yyyy",
}

export const DEFAULT_DISPLAY: DisplaySettings = { date_format: "YYYY-MM-DD", time_format: "24h", timezone: "UTC" }

function toZoned(value: string | Date, timezone: string): TZDate | null {
  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return null

  try {
    return new TZDate(date, timezone || "UTC")
  } catch {
    return new TZDate(date, "UTC")
  }
}

/** A date in the tenant timezone and the user's date format. Date-only strings are not shifted. */
export function formatDate(value: string | Date | null | undefined, display: DisplaySettings = DEFAULT_DISPLAY): string {
  if (value === null || value === undefined || value === "") return "—"

  const pattern = DATE_PATTERNS[display.date_format] ?? "yyyy-MM-dd"

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number)
    return formatWithPattern(new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1), pattern)
  }

  const zoned = toZoned(value, display.timezone)
  return zoned === null ? "—" : formatWithPattern(zoned, pattern)
}

export function formatTime(value: string | Date | null | undefined, display: DisplaySettings = DEFAULT_DISPLAY): string {
  if (value === null || value === undefined || value === "") return "—"

  const zoned = toZoned(value, display.timezone)
  return zoned === null ? "—" : formatWithPattern(zoned, display.time_format === "12h" ? "h:mm a" : "HH:mm")
}

export function formatDateTime(value: string | Date | null | undefined, display: DisplaySettings = DEFAULT_DISPLAY): string {
  if (value === null || value === undefined || value === "") return "—"
  return `${formatDate(value, display)} ${formatTime(value, display)}`
}

/** "3 minutes ago"; falls back to "—" for missing or invalid values. */
export function formatRelative(value: string | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—"

  const date = typeof value === "string" ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? "—" : formatDistanceToNowStrict(date, { addSuffix: true })
}

/**
 * Money from the API's decimal string, never converted through a float
 * first: Intl formats the string exactly.
 */
export function formatMoney(amount: string | number | null | undefined, currency: string | null | undefined, locale?: string): string {
  if (amount === null || amount === undefined || amount === "") return "—"

  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: currency || "USD" }).format(amount as unknown as number)
  } catch {
    return `${amount} ${currency ?? ""}`.trim()
  }
}

/** Quantities and counts with grouping; decimal strings keep their precision. */
export function formatNumber(value: string | number | null | undefined, options: Intl.NumberFormatOptions = {}, locale?: string): string {
  if (value === null || value === undefined || value === "") return "—"
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 4, ...options }).format(value as unknown as number)
}

/** "12.5%" from the API's percent strings. */
export function formatPercent(value: string | number | null | undefined, locale?: string): string {
  if (value === null || value === undefined || value === "") return "—"
  return `${formatNumber(value, { maximumFractionDigits: 1 }, locale)}%`
}

/** File sizes for uploads and exports. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let unit = 0

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`
}
