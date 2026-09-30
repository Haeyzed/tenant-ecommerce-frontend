"use client"

import { useMemo } from "react"

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@workspace/ui/components/combobox"

export type Option = { value: string; label: string }

/**
 * A multi-select over a short, already-loaded list (currencies, countries,
 * roles). Filtering happens in the browser; selections show as removable
 * chips. The value is the list of selected option values.
 */
export function MultiCombobox({
  id,
  options,
  value,
  onChange,
  placeholder = "Search…",
  emptyText = "No matches",
  chipLabel = (option) => option.label,
  invalid,
  disabled,
  loading,
}: {
  id?: string
  options: readonly Option[]
  value: readonly string[]
  onChange: (value: string[]) => void
  placeholder?: string
  emptyText?: string
  /** A shorter chip text, e.g. the currency code instead of its full name. */
  chipLabel?: (option: Option) => string
  invalid?: boolean
  disabled?: boolean
  loading?: boolean
}) {
  const anchor = useComboboxAnchor()
  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options])
  // Keep unknown values (not yet loaded, or retired) visible and removable.
  const selected = value.map((v) => byValue.get(v) ?? { value: v, label: v })

  return (
    <Combobox
      multiple
      autoHighlight
      items={options}
      value={selected}
      onValueChange={(next: Option[]) => onChange(next.map((o) => o.value))}
      itemToStringLabel={(item: Option) => item.label}
      isItemEqualToValue={(a: Option, b: Option) => a.value === b.value}
      disabled={disabled}
    >
      <ComboboxChips ref={anchor} className="w-full">
        <ComboboxValue>
          {(items: Option[]) => (
            <>
              {items.map((item) => (
                <ComboboxChip key={item.value}>{chipLabel(item)}</ComboboxChip>
              ))}
              <ComboboxChipsInput
                id={id}
                placeholder={items.length === 0 ? (loading ? "Loading…" : placeholder) : undefined}
                aria-invalid={invalid || undefined}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
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
