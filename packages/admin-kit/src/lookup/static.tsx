"use client"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@workspace/ui/components/combobox"

import type { Option } from "./multi"

/**
 * A single choice from a short, already-loaded list (currency, country,
 * timezone), filtered in the browser. For API-backed records, use
 * EntityCombobox, which searches the server.
 */
export function StaticCombobox({
  id,
  options,
  value,
  onChange,
  placeholder = "Search…",
  emptyText = "No matches",
  invalid,
  disabled,
  loading,
  clearable = false,
}: {
  id?: string
  options: readonly Option[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  emptyText?: string
  invalid?: boolean
  disabled?: boolean
  loading?: boolean
  clearable?: boolean
}) {
  // Keep an unknown value (not yet loaded, or retired) visible.
  const selected = value === null ? null : (options.find((o) => o.value === value) ?? { value, label: value })

  return (
    <Combobox
      autoHighlight
      items={options}
      value={selected}
      onValueChange={(next: Option | null) => onChange(next?.value ?? null)}
      itemToStringLabel={(item: Option) => item.label}
      isItemEqualToValue={(a: Option, b: Option) => a.value === b.value}
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        placeholder={loading ? "Loading…" : placeholder}
        showClear={clearable && selected !== null}
        aria-invalid={invalid || undefined}
        className="w-full"
      />
      <ComboboxContent>
        <ComboboxEmpty>{loading ? "Loading…" : emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(item: Option) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
