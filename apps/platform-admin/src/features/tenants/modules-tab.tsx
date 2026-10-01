"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { useCan } from "@workspace/access/react"
import { StaticCombobox } from "@workspace/admin-kit/lookup"
import { ErrorState } from "@workspace/admin-kit/states"
import { isApiError } from "@workspace/api-client"
import { formatDate, formatMoney } from "@workspace/format"
import { Button } from "@workspace/ui/components/button"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group"
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"
import { Icon } from "@workspace/ui/icons"

import { useLookup } from "@/features/lookups"
import { useConsole } from "@/shell/console-context"

import { featureOverridesQuery, useRemoveFeatureOverride, useSetFeatureOverride, type FeatureOverride, type TenantDetails, type TenantModule } from "./api"
import { MODULE_CLASS_LABELS, MODULE_SOURCE, MODULE_STATE, OVERRIDE_EFFECT } from "./labels"

const CLASS_ORDER = ["core", "module", "capability", "integration"]
type Effect = "grant" | "revoke" | "suspend"

/**
 * The store's modules (spec §11.12): effective state, where it comes from,
 * and per-store overrides that grant, revoke or suspend a module.
 */
export function ModulesTab({ details }: { details: TenantDetails }) {
  const { display } = useConsole()
  const tenantId = details.tenant.id
  const overrides = useQuery(featureOverridesQuery(tenantId))
  const remove = useRemoveFeatureOverride(tenantId)
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<TenantModule | null>(null)
  const [removing, setRemoving] = useState<TenantModule | null>(null)
  const canSet = useCan("landlord.plans.tenant-features.store")
  const canRemove = useCan("landlord.plans.tenant-features.destroy")

  const byKey = useMemo(() => new Map((overrides.data ?? []).map((o) => [o.feature_key, o])), [overrides.data])
  const groups = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const rows = details.modules.filter((m) => !needle || m.name.toLowerCase().includes(needle) || m.key.includes(needle))
    const map = new Map<string, TenantModule[]>()
    for (const m of rows) map.set(m.class, [...(map.get(m.class) ?? []), m])
    const rank = (c: string) => (CLASS_ORDER.includes(c) ? CLASS_ORDER.indexOf(c) : CLASS_ORDER.length)
    return [...map.entries()].sort(([a], [b]) => rank(a) - rank(b))
  }, [details.modules, search])
  const names = useMemo(() => new Map(details.modules.map((m) => [m.key, m.name])), [details.modules])

  async function confirmRemove() {
    if (!removing) return
    try {
      await remove.mutateAsync(removing.key)
      toast.add({ title: `${removing.name} follows the plan again`, type: "success" })
      setRemoving(null)
    } catch {
      toast.add({ title: "Couldn't remove the override", type: "error" })
    }
  }

  if (overrides.isError) return <ErrorState error={overrides.error} onRetry={() => void overrides.refetch()} />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">
          The plan decides which modules a store may use; an override changes that for this store only. Turning a module off keeps its data read-only.
        </p>
        <InputGroup className="w-full sm:w-64">
          <InputGroupAddon>
            <Icon name="search" />
          </InputGroupAddon>
          <InputGroupInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search modules" aria-label="Search modules" />
        </InputGroup>
      </div>

      {groups.map(([cls, modules]) => (
        <section key={cls} className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{MODULE_CLASS_LABELS[cls] ?? cls}</h3>
          <ul className="divide-y rounded-lg border">
            {modules.map((m) => {
              const override = byKey.get(m.key)
              const state = MODULE_STATE[m.state] ?? { label: m.state, tone: "neutral" as const }
              return (
                <li key={m.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{m.name}</span>
                      <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
                      {override ? <OverrideBadge override={override} display={display} /> : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      <span className="font-mono">{m.key}</span> · {MODULE_SOURCE[m.source] ?? m.source}
                      {m.missing_requirements.length > 0 ? (
                        <span className="text-warning"> · Needs {m.missing_requirements.map((r) => names.get(r) ?? r).join(", ")}</span>
                      ) : null}
                    </span>
                  </div>
                  {m.class !== "core" ? (
                    <div className="flex shrink-0 gap-1">
                      {canSet ? (
                        <Button variant="ghost" size="sm" onClick={() => setEditing(m)} disabled={overrides.isPending}>
                          {override ? "Change override" : "Override"}
                        </Button>
                      ) : null}
                      {override && canRemove ? (
                        <Button variant="ghost" size="sm" onClick={() => setRemoving(m)}>
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {overrides.isPending ? <Skeleton className="h-4 w-48" /> : null}

      <OverrideDialog tenantId={tenantId} module={editing} current={editing ? (byKey.get(editing.key) ?? null) : null} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => (o ? null : setRemoving(null))}
        title={`Remove the ${removing?.name ?? ""} override?`}
        description="The store goes back to what its plan includes."
        confirmLabel="Remove override"
        pending={remove.isPending}
        onConfirm={() => void confirmRemove()}
      />
    </div>
  )
}

function OverrideBadge({ override, display }: { override: FeatureOverride; display: ReturnType<typeof useConsole>["display"] }) {
  const effect = OVERRIDE_EFFECT[override.effect] ?? { label: override.effect, tone: "neutral" as const }
  const until = override.expires_at ? ` until ${formatDate(override.expires_at, display)}` : ""
  return (
    <StatusBadge tone={override.in_force ? effect.tone : "muted"}>
      {override.in_force ? `${effect.label}${until}` : `${effect.label} (not in force)`}
      {override.billed && override.extra_amount ? ` · ${formatMoney(override.extra_amount, override.extra_currency_code)}` : ""}
    </StatusBadge>
  )
}

function OverrideDialog({ tenantId, module, current, onClose }: { tenantId: string; module: TenantModule | null; current: FeatureOverride | null; onClose: () => void }) {
  return (
    <Dialog open={module !== null} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="sm:max-w-lg">{module ? <OverrideForm key={module.key} tenantId={tenantId} module={module} current={current} onDone={onClose} /> : null}</DialogContent>
    </Dialog>
  )
}

const toLocal = (iso: string | null) => (iso ? iso.slice(0, 10) : "")

function OverrideForm({ tenantId, module, current, onDone }: { tenantId: string; module: TenantModule; current: FeatureOverride | null; onDone: () => void }) {
  const save = useSetFeatureOverride(tenantId)
  const currencies = useLookup("currencies")
  const [effect, setEffect] = useState<Effect>(current?.effect === "revoke" ? "revoke" : current?.effect === "suspend" ? "suspend" : module.entitled ? "revoke" : "grant")
  const [expires, setExpires] = useState(toLocal(current?.expires_at ?? null))
  const [reason, setReason] = useState(current?.reason ?? "")
  const [billed, setBilled] = useState(current?.billed ?? false)
  const [amount, setAmount] = useState(current?.extra_amount ? String(Number(current.extra_amount)) : "")
  const [currency, setCurrency] = useState(current?.extra_currency_code ?? "")
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    const paid = effect === "grant" && billed
    if (paid && !(Number(amount) > 0)) next.amount = "Enter the monthly price of the add-on."
    if (paid && !currency) next.currency = "Choose a currency."
    if (expires && new Date(`${expires}T23:59:59`).getTime() <= Date.now()) next.expires = "Choose a date in the future."
    setErrors(next)
    if (Object.keys(next).length > 0) return

    try {
      await save.mutateAsync({
        feature_key: module.key,
        effect,
        expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
        reason: reason.trim() || null,
        billed: paid,
        extra_amount: paid ? Number(amount) : null,
        extra_currency_code: paid ? currency : null,
      })
      toast.add({ title: `${module.name}: override saved`, type: "success" })
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
      <DialogHeader>
        <DialogTitle>{module.name}</DialogTitle>
        <DialogDescription>{module.entitled ? "Included in this store's plan." : "Not included in this store's plan."} An override applies to this store only.</DialogDescription>
      </DialogHeader>
      {errors.form ? <p className="text-sm text-destructive">{errors.form}</p> : null}
      <FieldGroup>
        <RadioGroup value={effect} onValueChange={(v) => setEffect(v === "revoke" ? "revoke" : v === "suspend" ? "suspend" : "grant")} className="gap-2">
          {(
            [
              ["grant", "Grant", "Give the store this module even if the plan doesn't include it."],
              ["revoke", "Revoke", "Take the module away; its data stays read-only."],
              ["suspend", "Suspend", "Pause the module temporarily, e.g. for a billing dispute."],
            ] as const
          ).map(([value, title, description]) => (
            <FieldLabel key={value} htmlFor={`effect-${value}`}>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>{title}</FieldTitle>
                  <FieldDescription>{description}</FieldDescription>
                </FieldContent>
                <RadioGroupItem id={`effect-${value}`} value={value} />
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>

        {effect === "grant" ? (
          <>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>Charge for it</FieldTitle>
                <FieldDescription>Bill the store a monthly add-on price with its subscription.</FieldDescription>
              </FieldContent>
              <Switch checked={billed} onCheckedChange={setBilled} aria-label="Charge for it" />
            </Field>
            {billed ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={errors.amount || errors.extra_amount ? true : undefined}>
                  <FieldLabel htmlFor="addon-amount">Monthly price</FieldLabel>
                  <Input id="addon-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  <FieldError>{errors.amount ?? errors.extra_amount}</FieldError>
                </Field>
                <Field data-invalid={errors.currency || errors.extra_currency_code ? true : undefined}>
                  <FieldLabel htmlFor="addon-currency">Currency</FieldLabel>
                  <StaticCombobox id="addon-currency" options={currencies.data ?? []} loading={currencies.isPending} value={currency || null} onChange={(v) => setCurrency(v ?? "")} placeholder="Search" />
                  <FieldError>{errors.currency ?? errors.extra_currency_code}</FieldError>
                </Field>
              </div>
            ) : null}
          </>
        ) : null}

        <Field data-invalid={errors.expires || errors.expires_at ? true : undefined}>
          <FieldLabel htmlFor="override-expires">Ends (optional)</FieldLabel>
          <Input id="override-expires" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className="w-48" />
          {errors.expires || errors.expires_at ? <FieldError>{errors.expires ?? errors.expires_at}</FieldError> : <FieldDescription>Leave empty to keep it until removed.</FieldDescription>}
        </Field>
        <Field>
          <FieldLabel htmlFor="override-reason">Reason (optional)</FieldLabel>
          <Textarea id="override-reason" rows={2} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Spinner data-icon="inline-start" /> : null}
          Save override
        </Button>
      </DialogFooter>
    </form>
  )
}
