"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"
import { Controller, type Control } from "react-hook-form"

import { EntityCombobox } from "@workspace/admin-kit/lookup"
import { unwrap } from "@workspace/api-client"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel, FieldTitle } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"
import { Icon } from "@workspace/ui/icons"

import { api } from "@/shell/api-client"

import type { SettingEntry } from "./api"
import { FIELDS, JSON_EDITORS, MULTILINE, SOCIAL_LABELS, SOCIAL_NETWORKS, fieldLabel, optionLabel } from "./meta"

type Option = { value: string; label: string }

const isOption = (row: unknown): row is { value: string | number; label: string } =>
  typeof row === "object" && row !== null && "value" in row && "label" in row && typeof row.label === "string"

/** Every IANA timezone the browser knows: the same set Laravel's `timezone:all` accepts. */
function timezones(): Option[] {
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC"]
  return zones.map((zone) => ({ value: zone, label: zone.replace(/_/g, " ") }))
}

function Described({ settingKey, entry }: { settingKey: string; entry: SettingEntry }) {
  const description = FIELDS[settingKey]?.description
  return (
    <>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {entry.reason_required ? (
        <FieldDescription className="flex items-center gap-1.5">
          <Icon name="info" className="size-3.5" />
          Changes need a reason, recorded in the audit log.
        </FieldDescription>
      ) : null}
    </>
  )
}

/** Local search over a fixed option list (timezones). */
function StaticCombobox({ id, value, options, onChange, invalid }: { id: string; value: string | null; options: Option[]; onChange: (v: string | null) => void; invalid: boolean }) {
  const selected = options.find((o) => o.value === value) ?? (value ? { value, label: value } : null)

  return (
    <EntityCombobox<Option>
      id={id}
      queryKey={["static-options", id]}
      search={async (term) => {
        const needle = term.toLowerCase()
        return (needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options).slice(0, 50)
      }}
      value={selected}
      onChange={(o) => onChange(o?.value ?? null)}
      getId={(o) => o.value}
      getLabel={(o) => o.label}
      invalid={invalid}
      clearable={false}
    />
  )
}

/** Currency search over the landlord currency lookup (fetched once, cached). */
function CurrencyCombobox({ id, value, onChange, invalid }: { id: string; value: string | null; onChange: (v: string | null) => void; invalid: boolean }) {
  const queryClient = useQueryClient()

  return (
    <EntityCombobox<Option>
      id={id}
      queryKey={["lookup-search", "currencies"]}
      search={async (term) => {
        const rows = await queryClient.fetchQuery({
          queryKey: ["lookup", "currencies"],
          queryFn: async ({ signal }) => {
            const data = await unwrap(api.GET("/lookups/{key}", { params: { path: { key: "currencies" } }, signal }))
            return (Array.isArray(data) ? data : []).filter(isOption).map((row) => ({ value: String(row.value), label: row.label }))
          },
          staleTime: 30 * 60_000,
        })
        const needle = term.toLowerCase()
        return (needle ? rows.filter((r) => r.label.toLowerCase().includes(needle)) : rows).slice(0, 50)
      }}
      value={value ? { value, label: value } : null}
      onChange={(o) => onChange(o?.value ?? null)}
      getId={(o) => o.value}
      getLabel={(o) => o.label}
      invalid={invalid}
      clearable={false}
    />
  )
}

/** { "USD": "1.00", "NGN": "1600" } as editable rows. */
function CurrencyMapEditor({ value, onChange, idPrefix }: { value: Record<string, unknown>; onChange: (v: Record<string, string>) => void; idPrefix: string }) {
  const rows = Object.entries(value ?? {}).map(([currency, amount]) => ({ currency, amount: String(amount ?? "") }))
  const write = (next: { currency: string; amount: string }[]) =>
    onChange(Object.fromEntries(next.filter((r) => r.currency).map((r) => [r.currency.toUpperCase(), r.amount])))

  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No currencies yet.</p> : null}
      {rows.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            aria-label="Currency code"
            id={index === 0 ? idPrefix : undefined}
            value={row.currency}
            maxLength={3}
            className="w-24 font-mono uppercase"
            onChange={(e) => write(rows.map((r, i) => (i === index ? { ...r, currency: e.target.value.toUpperCase() } : r)))}
          />
          <Input
            aria-label={`Amount for ${row.currency || "currency"}`}
            inputMode="decimal"
            value={row.amount}
            className="flex-1"
            onChange={(e) => write(rows.map((r, i) => (i === index ? { ...r, amount: e.target.value } : r)))}
          />
          <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${row.currency || "row"}`} onClick={() => write(rows.filter((_, i) => i !== index))}>
            <Icon name="delete" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => write([...rows, { currency: "", amount: "" }])}>
        <Icon name="add" data-icon="inline-start" />
        Add currency
      </Button>
    </div>
  )
}

/**
 * Renders one setting as the right input from its type and constraints
 * (BG-18): switch, select, timezone or currency search, number, text,
 * or a structured editor for JSON values. Own-route keys are read-only.
 */
/** The settings form: setting key to the value being edited. */
export type SettingsFormValues = Record<string, unknown>

export function SettingField({ settingKey, entry, control }: { settingKey: string; entry: SettingEntry; control: Control<SettingsFormValues> }) {
  const id = `setting-${settingKey}`
  const label = fieldLabel(settingKey)
  const zones = useMemo(() => (settingKey === "default_timezone" ? timezones() : []), [settingKey])

  if (entry.own_route) {
    return (
      <Field orientation="responsive">
        <FieldContent>
          <FieldTitle>{label}</FieldTitle>
          <Described settingKey={settingKey} entry={entry} />
        </FieldContent>
        <Badge variant="outline" className="capitalize">
          {optionLabel(String(entry.value ?? "—"))}
        </Badge>
      </Field>
    )
  }

  return (
    <Controller
      control={control}
      name={settingKey}
      render={({ field, fieldState }) => {
        const invalid = fieldState.invalid
        const error = <FieldError errors={[fieldState.error]} />

        if (entry.type === "bool") {
          return (
            <Field orientation="horizontal" data-invalid={invalid || undefined}>
              <FieldContent>
                <FieldLabel htmlFor={id}>{label}</FieldLabel>
                <Described settingKey={settingKey} entry={entry} />
                {error}
              </FieldContent>
              <Switch id={id} checked={field.value === true} onCheckedChange={(checked) => field.onChange(checked === true)} />
            </Field>
          )
        }

        let control: React.ReactNode

        if (entry.options && entry.options.length > 0) {
          const items = entry.options.map((o) => ({ value: o, label: optionLabel(o) }))
          control = (
            <Select value={field.value == null ? null : String(field.value)} onValueChange={(v) => field.onChange(v)} items={items}>
              <SelectTrigger id={id} className="w-full sm:w-72" aria-invalid={invalid || undefined}>
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {items.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )
        } else if (settingKey === "default_timezone") {
          control = <StaticCombobox id={id} value={typeof field.value === "string" ? field.value : null} options={zones} onChange={field.onChange} invalid={invalid} />
        } else if (settingKey === "default_currency") {
          control = <CurrencyCombobox id={id} value={typeof field.value === "string" ? field.value : null} onChange={field.onChange} invalid={invalid} />
        } else if (JSON_EDITORS[settingKey] === "social") {
          const links = (field.value && typeof field.value === "object" ? field.value : {}) as Record<string, string | null>
          control = (
            <div className="grid gap-2 sm:grid-cols-2">
              {SOCIAL_NETWORKS.map((network) => (
                <InputGroup key={network}>
                  <InputGroupAddon className="w-24 justify-start text-muted-foreground">{SOCIAL_LABELS[network]}</InputGroupAddon>
                  <InputGroupInput
                    id={network === "facebook" ? id : undefined}
                    type="url"
                    placeholder="https://"
                    value={links[network] ?? ""}
                    onChange={(e) => field.onChange({ ...links, [network]: e.target.value || null })}
                  />
                </InputGroup>
              ))}
            </div>
          )
        } else if (JSON_EDITORS[settingKey] === "currency-map") {
          control = <CurrencyMapEditor idPrefix={id} value={(field.value ?? {}) as Record<string, unknown>} onChange={field.onChange} />
        } else if (JSON_EDITORS[settingKey] === "lines") {
          const text = Array.isArray(field.value) ? field.value.join("\n") : typeof field.value === "string" ? field.value : ""
          control = (
            <Textarea
              id={id}
              rows={3}
              className="font-mono"
              value={text}
              aria-invalid={invalid || undefined}
              onChange={(e) =>
                field.onChange(
                  e.target.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                )
              }
            />
          )
        } else if (entry.type === "int" || entry.type === "decimal") {
          control = (
            <Input
              id={id}
              type="number"
              inputMode={entry.type === "int" ? "numeric" : "decimal"}
              step={entry.type === "int" ? 1 : "any"}
              min={entry.min ?? undefined}
              max={entry.max ?? undefined}
              className="w-full sm:w-48"
              aria-invalid={invalid || undefined}
              value={field.value == null ? "" : String(field.value)}
              onChange={(e) => field.onChange(e.target.value)}
            />
          )
        } else if (MULTILINE.has(settingKey)) {
          control = (
            <Textarea
              id={id}
              rows={3}
              maxLength={entry.max ?? undefined}
              aria-invalid={invalid || undefined}
              value={field.value == null ? "" : String(field.value)}
              onChange={(e) => field.onChange(e.target.value)}
            />
          )
        } else {
          control = (
            <Input
              id={id}
              maxLength={entry.max ?? undefined}
              aria-invalid={invalid || undefined}
              value={field.value == null ? "" : String(field.value)}
              onChange={(e) => field.onChange(e.target.value)}
            />
          )
        }

        return (
          <Field data-invalid={invalid || undefined}>
            <FieldLabel htmlFor={id}>
              {label}
              {entry.nullable ? <span className="font-normal text-muted-foreground">(optional)</span> : null}
            </FieldLabel>
            {control}
            <Described settingKey={settingKey} entry={entry} />
            {error}
          </Field>
        )
      }}
    />
  )
}
