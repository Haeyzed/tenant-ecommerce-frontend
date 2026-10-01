"use client"

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"

const ALL = "__all__"

/**
 * A list filter over a fixed set of values, with an "any" choice that
 * clears it. The value type is kept: onChange receives one of the given
 * values or null, never an arbitrary string.
 */
export function FilterSelect<V extends string>({
  label,
  value,
  options,
  onChange,
  anyLabel,
  className,
}: {
  /** Accessible name, e.g. "Status". */
  label: string
  value: V | null
  options: readonly { value: V; label: string }[]
  onChange: (value: V | null) => void
  /** The clearing choice, e.g. "Any status". */
  anyLabel: string
  className?: string
}) {
  const items = [{ value: ALL, label: anyLabel }, ...options]

  return (
    <Select
      value={value ?? ALL}
      onValueChange={(next) => onChange(options.find((o) => o.value === next)?.value ?? null)}
      items={items}
    >
      <SelectTrigger aria-label={label} className={cn("w-full sm:w-44", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
