"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useState } from "react"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@workspace/ui/components/combobox"
import { Spinner } from "@workspace/ui/components/spinner"
import { useDebouncedValue } from "@workspace/ui/hooks/use-debounced-value"

export type LookupSearch<T> = (
  term: string,
  signal: AbortSignal
) => Promise<T[]>

/**
 * The API-backed lookup used for every relational field (customers,
 * products, warehouses, …). It searches the API as the user types
 * (300 ms debounce), never loads the whole list, cancels stale requests,
 * and caches results for 30 minutes (spec §14.3). The value is the selected
 * item itself, so an edit form shows its label from the record's embedded
 * relation without an extra request.
 */
export function EntityCombobox<T>({
  queryKey,
  search,
  value,
  onChange,
  getId,
  getLabel,
  getDescription,
  placeholder = "Search…",
  emptyText = "No matches",
  disabled,
  invalid,
  id,
  clearable = true,
  minChars = 0,
}: {
  /** A stable key for this lookup, e.g. ["lookup", "customers"]. */
  queryKey: readonly unknown[]
  search: LookupSearch<T>
  value: T | null
  onChange: (value: T | null) => void
  getId: (item: T) => string | number
  getLabel: (item: T) => string
  getDescription?: (item: T) => string | null | undefined
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  invalid?: boolean
  id?: string
  clearable?: boolean
  /** Characters required before searching; 0 lists the first page when opened. */
  minChars?: number
}) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState("")
  const debounced = useDebouncedValue(term.trim(), 300)
  const enabled = open && debounced.length >= minChars

  const results = useQuery({
    queryKey: [...queryKey, { search: debounced }],
    queryFn: ({ signal }) => search(debounced, signal),
    enabled,
    staleTime: 30 * 60_000,
    placeholderData: keepPreviousData,
  })

  const items = results.data ?? []
  // Keep the selected item available even when it is not in the current results.
  const options =
    value !== null && !items.some((item) => getId(item) === getId(value))
      ? [value, ...items]
      : items

  return (
    <Combobox
      items={options}
      filter={null}
      value={value}
      onValueChange={(next) => onChange((next as T | null) ?? null)}
      onInputValueChange={(text) => setTerm(text)}
      onOpenChange={setOpen}
      itemToStringLabel={(item: T) => getLabel(item)}
      isItemEqualToValue={(a: T, b: T) => getId(a) === getId(b)}
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        showClear={clearable && value !== null}
        aria-invalid={invalid || undefined}
        className="w-full"
      />
      <ComboboxContent>
        <ComboboxEmpty>
          {results.isFetching ? (
            <span className="inline-flex items-center gap-2">
              <Spinner /> Searching…
            </span>
          ) : results.isError ? (
            "Search failed. Keep typing to try again."
          ) : debounced.length < minChars ? (
            `Type at least ${minChars} characters`
          ) : (
            emptyText
          )}
        </ComboboxEmpty>
        <ComboboxList>
          {(item: T) => {
            const description = getDescription?.(item)
            return (
              <ComboboxItem key={getId(item)} value={item}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{getLabel(item)}</span>
                  {description ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {description}
                    </span>
                  ) : null}
                </span>
              </ComboboxItem>
            )
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
