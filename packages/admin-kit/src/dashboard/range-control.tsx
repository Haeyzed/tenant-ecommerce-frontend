"use client"

import { useState } from "react"

import { formatDate, type DisplaySettings } from "@workspace/format"
import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"
import { Icon } from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"

import { COMPARE_OPTIONS, MAX_CUSTOM_DAYS, RANGE_PRESETS, type CompareOption, type DashboardQuery, type RangePreset } from "./types"

type Draft = { from?: Date | undefined; to?: Date | undefined }

/** Y-m-d from a calendar day (local date parts, no timezone shift). */
function ymd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function fromYmd(value: string): Date | undefined {
  const [y, m, d] = value.split("-").map(Number)
  return y && m && d ? new Date(y, m - 1, d) : undefined
}

const DAY_MS = 24 * 60 * 60 * 1000

function spanDays(draft: Draft): number | null {
  return draft.from && draft.to ? Math.round((draft.to.getTime() - draft.from.getTime()) / DAY_MS) : null
}

export function rangeLabel(query: DashboardQuery, display: DisplaySettings | undefined): string {
  if (query.range !== "custom") return RANGE_PRESETS.find((p) => p.value === query.range)?.label ?? query.range
  return `${formatDate(query.from, display)} – ${formatDate(query.to, display)}`
}

/**
 * The dashboard's date range (spec §22.1): the backend presets, a custom
 * range of up to two years, and the comparison. Changes apply to every
 * section and are kept in the URL.
 */
export function RangeControl({
  query,
  onChange,
  display,
}: {
  query: DashboardQuery
  onChange: (query: DashboardQuery) => void
  display?: DisplaySettings | undefined
}) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(() =>
    query.range === "custom" ? { from: fromYmd(query.from), to: fromYmd(query.to) } : {}
  )

  const span = spanDays(draft)
  const tooLong = span !== null && span > MAX_CUSTOM_DAYS
  const today = new Date()

  function pickPreset(range: RangePreset) {
    onChange({ range, compare: query.compare })
    setOpen(false)
  }

  function applyCustom() {
    if (!draft.from || !draft.to || tooLong) return
    onChange({ range: "custom", from: ymd(draft.from), to: ymd(draft.to), compare: query.compare })
    setOpen(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button variant="outline" className="min-w-44 justify-start" aria-label="Date range" />}>
          <Icon name="calendar" className="text-muted-foreground" data-icon="inline-start" />
          {rangeLabel(query, display)}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto max-w-[calc(100vw-2rem)] p-0">
          <div className="flex flex-col sm:flex-row">
            <div className="grid grid-cols-2 gap-1 border-b p-2 sm:flex sm:w-40 sm:flex-col sm:border-e sm:border-b-0" role="group" aria-label="Presets">
              {RANGE_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  variant={query.range === preset.value ? "secondary" : "ghost"}
                  size="sm"
                  className="justify-start"
                  aria-pressed={query.range === preset.value}
                  onClick={() => pickPreset(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-col gap-2 p-2">
              <Calendar
                mode="range"
                numberOfMonths={isMobile ? 1 : 2}
                selected={draft.from ? { from: draft.from, to: draft.to } : undefined}
                onSelect={(next: Draft | undefined) => setDraft(next ?? {})}
                defaultMonth={draft.from ?? new Date(today.getFullYear(), today.getMonth() - (isMobile ? 0 : 1), 1)}
                disabled={{ after: today }}
              />
              <div className="flex items-center justify-between gap-3 border-t px-1 pt-2">
                <p className={cn("text-xs", tooLong ? "text-destructive" : "text-muted-foreground")}>
                  {tooLong
                    ? `Choose at most ${MAX_CUSTOM_DAYS} days.`
                    : draft.from && draft.to
                      ? `${formatDate(ymd(draft.from), display)} – ${formatDate(ymd(draft.to), display)}`
                      : "Pick a start and an end date."}
                </p>
                <Button size="sm" disabled={!draft.from || !draft.to || tooLong} onClick={applyCustom}>
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Select
        value={query.compare}
        onValueChange={(value) => {
          const compare = COMPARE_OPTIONS.find((o) => o.value === value)?.value
          if (compare) onChange({ ...query, compare })
        }}
        items={COMPARE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
      >
        <SelectTrigger aria-label="Comparison" className="min-w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectGroup>
            {COMPARE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

export type { CompareOption }
