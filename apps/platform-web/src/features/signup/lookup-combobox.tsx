"use client"

import { useQuery } from "@tanstack/react-query"

import { unwrap } from "@workspace/api-client"
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@workspace/ui/components/combobox"

import { api } from "@/shell/api-client"

export type LookupOption = { value: string; label: string }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null

function toOptions(data: unknown): LookupOption[] {
  return (Array.isArray(data) ? data : []).flatMap((row): LookupOption[] =>
    isRecord(row) && (typeof row.value === "string" || typeof row.value === "number") && typeof row.label === "string"
      ? [{ value: String(row.value), label: row.label }]
      : []
  )
}

/**
 * A short public lookup (countries, currencies) loaded once and filtered in
 * the browser. These lists are small and static, so one request beats a
 * search round-trip per keystroke (spec §14.3).
 */
export function LookupCombobox({
  lookup,
  id,
  value,
  onChange,
  invalid,
  placeholder = "Search…",
  clearable = false,
}: {
  lookup: "countries" | "currencies"
  id: string
  value: string | null
  onChange: (value: string | null) => void
  invalid?: boolean
  placeholder?: string
  clearable?: boolean
}) {
  const options = useQuery({
    queryKey: ["lookup", lookup],
    queryFn: async ({ signal }) => toOptions(await unwrap(api.GET("/lookups/{key}", { params: { path: { key: lookup } }, signal }))),
    staleTime: 30 * 60_000,
  })

  const items = options.data ?? []
  const selected = items.find((o) => o.value === value) ?? null

  return (
    <Combobox
      items={items}
      value={selected}
      onValueChange={(next: LookupOption | null) => onChange(next?.value ?? null)}
      itemToStringLabel={(item: LookupOption) => item.label}
      isItemEqualToValue={(a: LookupOption, b: LookupOption) => a.value === b.value}
    >
      <ComboboxInput
        id={id}
        placeholder={options.isPending ? "Loading…" : placeholder}
        showClear={clearable && selected !== null}
        aria-invalid={invalid || undefined}
        className="w-full"
      />
      <ComboboxContent>
        <ComboboxEmpty>{options.isError ? "Couldn't load the list. Refresh to try again." : "No matches"}</ComboboxEmpty>
        <ComboboxList>
          {(item: LookupOption) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
