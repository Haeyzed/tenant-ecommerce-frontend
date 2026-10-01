"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { useCan } from "@workspace/access/react"
import { StaticCombobox } from "@workspace/admin-kit/lookup"
import { ErrorState } from "@workspace/admin-kit/states"
import { isApiError, unwrap } from "@workspace/api-client"
import { formatDate, formatMoney, formatNumber } from "@workspace/format"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription, ResponsiveDialogFooter, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@workspace/ui/components/responsive-dialog"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import { Switch } from "@workspace/ui/components/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"

import { useLookup } from "@/features/lookups"
import { api } from "@/shell/api-client"
import { useConsole } from "@/shell/console-context"

import { limitOverridesQuery, useRemoveLimitOverride, useSetLimitOverride, type LimitOverride, type TenantDetails } from "./api"

/** A registered limit, from the admin `limit-keys` lookup (config/limits.php). */
type LimitKey = { key: string; label: string; kind: string; unlimitedAllowed: boolean }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null

const limitKeysQuery = {
  queryKey: ["lookup", "admin", "limit-keys"] as const,
  queryFn: async ({ signal }: { signal: AbortSignal }): Promise<LimitKey[]> => {
    const rows = await unwrap(api.GET("/admin/lookups/{key}", { params: { path: { key: "limit-keys" } }, signal }))
    return (Array.isArray(rows) ? rows : []).flatMap((r): LimitKey[] => {
      if (!isRecord(r) || typeof r.value !== "string" || typeof r.label !== "string") return []
      const meta = isRecord(r.meta) ? r.meta : {}
      return [{ key: r.value, label: r.label, kind: typeof meta.kind === "string" ? meta.kind : "count", unlimitedAllowed: meta.unlimited_allowed === true }]
    })
  },
  staleTime: 30 * 60_000,
}

function amount(key: string, value: number | null): string {
  if (value === null) return "Unlimited"
  return key === "max_storage_mb" ? (value >= 1024 ? `${formatNumber(value / 1024, { maximumFractionDigits: 1 })} GB` : `${value} MB`) : formatNumber(value)
}

/** Limits with this store's usage and overrides (spec §11.8). */
export function LimitsTab({ details }: { details: TenantDetails }) {
  const { display } = useConsole()
  const tenantId = details.tenant.id
  const keys = useQuery(limitKeysQuery)
  const overrides = useQuery(limitOverridesQuery(tenantId))
  const remove = useRemoveLimitOverride(tenantId)
  const [editing, setEditing] = useState<LimitKey | null>(null)
  const [removing, setRemoving] = useState<LimitKey | null>(null)
  const canSet = useCan("landlord.plans.tenant-limit-overrides.update")
  const canRemove = useCan("landlord.plans.tenant-limit-overrides.destroy")

  const byKey = useMemo(() => new Map((overrides.data ?? []).map((o) => [o.limit_key, o])), [overrides.data])

  async function confirmRemove() {
    if (!removing) return
    try {
      await remove.mutateAsync(removing.key)
      toast.add({ title: `${removing.label} follows the plan again`, type: "success" })
      setRemoving(null)
    } catch {
      toast.add({ title: "Couldn't remove the override", type: "error" })
    }
  }

  if (keys.isError) return <ErrorState error={keys.error} onRetry={() => void keys.refetch()} />
  if (overrides.isError) return <ErrorState error={overrides.error} onRetry={() => void overrides.refetch()} />
  if (keys.isPending || overrides.isPending) return <Skeleton className="h-96 w-full" />

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl text-sm text-muted-foreground">
        An override replaces the plan&apos;s limit for this store, for example a temporary raise or a paid extra. Lowering a limit never deletes data.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Limit</TableHead>
              <TableHead className="text-end">Used</TableHead>
              <TableHead className="text-end">Limit now</TableHead>
              <TableHead>Override</TableHead>
              {canSet || canRemove ? <TableHead className="text-end">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.data.map((k) => {
              const usage = details.usage?.[k.key]
              const override = byKey.get(k.key)
              return (
                <TableRow key={k.key}>
                  <TableCell className="font-medium">{k.label}</TableCell>
                  <TableCell className="text-end tabular-nums">{usage?.used === null || usage === undefined ? "—" : amount(k.key, usage.used)}</TableCell>
                  <TableCell className="text-end tabular-nums">{usage ? amount(k.key, usage.limit) : "—"}</TableCell>
                  <TableCell>{override ? <OverrideSummary limitKey={k.key} override={override} display={display} /> : <span className="text-muted-foreground">Plan</span>}</TableCell>
                  {canSet || canRemove ? (
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        {canSet ? (
                          <Button variant="ghost" size="sm" onClick={() => setEditing(k)}>
                            {override ? "Change" : "Override"}
                          </Button>
                        ) : null}
                        {override && canRemove ? (
                          <Button variant="ghost" size="sm" onClick={() => setRemoving(k)}>
                            Remove
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <ResponsiveDialog open={editing !== null} onOpenChange={(o) => (o ? null : setEditing(null))}>
        <ResponsiveDialogContent className="sm:max-w-lg">
          {editing ? <LimitForm key={editing.key} tenantId={tenantId} limit={editing} current={byKey.get(editing.key) ?? null} planLimit={details.usage?.[editing.key]?.limit} onDone={() => setEditing(null)} /> : null}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => (o ? null : setRemoving(null))}
        title={`Remove the ${removing?.label ?? ""} override?`}
        description="The store goes back to its plan's limit. If it is already above it, it keeps its data but can't add more."
        confirmLabel="Remove override"
        pending={remove.isPending}
        onConfirm={() => void confirmRemove()}
      />
    </div>
  )
}

function OverrideSummary({ limitKey, override, display }: { limitKey: string; override: LimitOverride; display: ReturnType<typeof useConsole>["display"] }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <StatusBadge tone={override.in_force ? "info" : "muted"}>
        {amount(limitKey, override.limit_value)}
        {override.expires_at ? ` until ${formatDate(override.expires_at, display)}` : ""}
        {override.in_force ? "" : " (not in force)"}
      </StatusBadge>
      {override.billed && override.extra_amount ? <span className="text-xs text-muted-foreground">{formatMoney(override.extra_amount, override.extra_currency_code)}/mo</span> : null}
    </span>
  )
}

function LimitForm({
  tenantId,
  limit,
  current,
  planLimit,
  onDone,
}: {
  tenantId: string
  limit: LimitKey
  current: LimitOverride | null
  planLimit: number | null | undefined
  onDone: () => void
}) {
  const save = useSetLimitOverride(tenantId)
  const currencies = useLookup("currencies")
  const [value, setValue] = useState(current?.limit_value === null || current === null ? "" : String(current.limit_value))
  const [unlimited, setUnlimited] = useState(current !== null && current.limit_value === null && limit.unlimitedAllowed)
  const [expires, setExpires] = useState(current?.expires_at ? current.expires_at.slice(0, 10) : "")
  const [reason, setReason] = useState(current?.reason ?? "")
  const [billed, setBilled] = useState(current?.billed ?? false)
  const [price, setPrice] = useState(current?.extra_amount ? String(Number(current.extra_amount)) : "")
  const [currency, setCurrency] = useState(current?.extra_currency_code ?? "")
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!unlimited && !/^\d+$/.test(value.trim())) next.limit_value = "Enter a whole number."
    if (billed && !(Number(price) > 0)) next.extra_amount = "Enter the monthly price."
    if (billed && !currency) next.extra_currency_code = "Choose a currency."
    if (expires && new Date(`${expires}T23:59:59`).getTime() <= Date.now()) next.expires_at = "Choose a date in the future."
    setErrors(next)
    if (Object.keys(next).length > 0) return

    try {
      await save.mutateAsync({
        limit_key: limit.key,
        limit_value: unlimited ? null : Number(value),
        expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
        reason: reason.trim() || null,
        billed,
        extra_amount: billed ? Number(price) : null,
        extra_currency_code: billed ? currency : null,
      })
      toast.add({ title: `${limit.label}: override saved`, type: "success" })
      onDone()
    } catch (error) {
      if (isApiError(error)) {
        const fields = Object.fromEntries(Object.entries(error.fieldErrors).map(([k, v]) => [k, v.join(" ")]))
        setErrors(Object.keys(fields).length > 0 ? fields : { form: error.message })
      } else {
        setErrors({ form: "Couldn't save the override. Try again." })
      }
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6">
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>{limit.label}</ResponsiveDialogTitle>
        <ResponsiveDialogDescription>Plan limit: {planLimit === undefined ? "—" : amount(limit.key, planLimit)}. The override applies to this store only.</ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      {errors.form ? <p className="text-sm text-destructive">{errors.form}</p> : null}
      <FieldGroup>
        <Field data-invalid={errors.limit_value ? true : undefined}>
          <FieldLabel htmlFor="limit-value">New limit{limit.key === "max_storage_mb" ? " (MB)" : ""}</FieldLabel>
          <div className="flex flex-wrap items-center gap-3">
            <Input id="limit-value" inputMode="numeric" value={unlimited ? "" : value} disabled={unlimited} placeholder={unlimited ? "Unlimited" : undefined} onChange={(e) => setValue(e.target.value)} className="w-40" />
            {limit.unlimitedAllowed ? (
              <Label className="flex items-center gap-2 font-normal">
                <Checkbox checked={unlimited} onCheckedChange={(c) => setUnlimited(c === true)} />
                Unlimited
              </Label>
            ) : null}
          </div>
          <FieldError>{errors.limit_value}</FieldError>
        </Field>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldTitle>Charge for it</FieldTitle>
            <FieldDescription>Bill a monthly extra with the store&apos;s subscription.</FieldDescription>
          </FieldContent>
          <Switch checked={billed} onCheckedChange={setBilled} aria-label="Charge for it" />
        </Field>
        {billed ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={errors.extra_amount ? true : undefined}>
              <FieldLabel htmlFor="limit-price">Monthly price</FieldLabel>
              <Input id="limit-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
              <FieldError>{errors.extra_amount}</FieldError>
            </Field>
            <Field data-invalid={errors.extra_currency_code ? true : undefined}>
              <FieldLabel htmlFor="limit-currency">Currency</FieldLabel>
              <StaticCombobox id="limit-currency" options={currencies.data ?? []} loading={currencies.isPending} value={currency || null} onChange={(v) => setCurrency(v ?? "")} placeholder="Search" />
              <FieldError>{errors.extra_currency_code}</FieldError>
            </Field>
          </div>
        ) : null}
        <Field data-invalid={errors.expires_at ? true : undefined}>
          <FieldLabel htmlFor="limit-expires">Ends (optional)</FieldLabel>
          <Input id="limit-expires" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className="w-48" />
          {errors.expires_at ? <FieldError>{errors.expires_at}</FieldError> : <FieldDescription>Leave empty to keep it until removed.</FieldDescription>}
        </Field>
        <Field>
          <FieldLabel htmlFor="limit-reason">Reason (optional)</FieldLabel>
          <Textarea id="limit-reason" rows={2} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </FieldGroup>
      <ResponsiveDialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Spinner data-icon="inline-start" /> : null}
          Save override
        </Button>
      </ResponsiveDialogFooter>
    </form>
  )
}
