"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm, useWatch, type FieldError as FieldErrorType } from "react-hook-form"
import { z } from "zod"

import { useCan } from "@workspace/access/react"
import { FormErrors, applyApiErrors } from "@workspace/admin-kit/forms"
import { StaticCombobox } from "@workspace/admin-kit/lookup"
import { StateView } from "@workspace/admin-kit/states"
import { formatMoney } from "@workspace/format"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription, ResponsiveDialogFooter, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@workspace/ui/components/responsive-dialog"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select"
import { Spinner } from "@workspace/ui/components/spinner"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import { Switch } from "@workspace/ui/components/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { toast } from "@workspace/ui/components/toast"
import { Icon } from "@workspace/ui/icons"

import { useLookup } from "@/features/lookups"

import { INTERVAL_LABELS, useAddPrice, useUpdatePrice, type Plan, type PlanPrice } from "./api"

/** Empty means "use the platform's default trial". */
const trialDays = z
  .string()
  .trim()
  .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) <= 365), "Enter 0 to 365 days, or leave empty for the default.")

const trialValue = (v: string) => (v === "" ? null : Number(v))

function trialText(price: PlanPrice) {
  if (price.trialDays === null) return price.resolvedTrialDays > 0 ? `Default (${price.resolvedTrialDays} days)` : "Default (none)"
  return price.trialDays === 0 ? "No trial" : `${price.trialDays} days`
}

/**
 * A plan's prices (spec §11.6): one active price per currency and interval.
 * Amounts never change; a new amount is a new price, which retires the old
 * one for new subscribers. Existing subscribers keep the price they have.
 */
export function PricesTab({ plan }: { plan: Plan }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<PlanPrice | null>(null)
  const [toggling, setToggling] = useState<PlanPrice | null>(null)
  const update = useUpdatePrice(plan.id)
  const canAdd = useCan("landlord.plans.prices.store")
  const canUpdate = useCan("landlord.plans.prices.update")

  const prices = [...plan.prices].sort((a, b) => Number(b.active) - Number(a.active) || a.currency.localeCompare(b.currency) || a.interval.localeCompare(b.interval))

  async function toggle(price: PlanPrice) {
    try {
      await update.mutateAsync({ priceId: price.id, body: { is_active: !price.active } })
      toast.add({ title: price.active ? "Price retired" : "Price reactivated", type: "success" })
      setToggling(null)
    } catch (error) {
      toast.add({ title: "Couldn't update the price", description: error instanceof Error ? error.message : undefined, type: "error" })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Stores pay the active price in their currency. Amounts can&apos;t be edited: add a new price instead, and existing subscribers keep theirs.
        </p>
        {canAdd ? (
          <Button onClick={() => setAdding(true)} className="shrink-0">
            <Icon name="add" data-icon="inline-start" />
            Add price
          </Button>
        ) : null}
      </div>

      {prices.length === 0 ? (
        <StateView icon="money" title="No prices yet" description="Add a monthly or yearly price so stores can buy this plan." />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Price</TableHead>
                <TableHead>Trial</TableHead>
                <TableHead className="hidden sm:table-cell">Card for trial</TableHead>
                <TableHead>Status</TableHead>
                {canUpdate ? <TableHead className="text-end">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {prices.map((price) => (
                <TableRow key={price.id} className={price.active ? undefined : "text-muted-foreground"}>
                  <TableCell>
                    <span className="flex flex-col">
                      <span className="font-medium tabular-nums">{formatMoney(price.amount, price.currency)}</span>
                      <span className="text-xs text-muted-foreground">
                        {price.currency} · {INTERVAL_LABELS[price.interval]}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>{trialText(price)}</TableCell>
                  <TableCell className="hidden sm:table-cell">{price.trialRequiresCard ? "Required" : "Not required"}</TableCell>
                  <TableCell>
                    <StatusBadge tone={price.active ? "success" : "muted"}>{price.active ? "Active" : "Retired"}</StatusBadge>
                  </TableCell>
                  {canUpdate ? (
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(price)}>
                          Trial
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setToggling(price)}>
                          {price.active ? "Retire" : "Reactivate"}
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AddPriceDialog plan={plan} open={adding} onOpenChange={setAdding} />
      <TrialDialog plan={plan} price={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={toggling !== null}
        onOpenChange={(open) => (open ? null : setToggling(null))}
        title={toggling?.active ? "Retire this price?" : "Reactivate this price?"}
        description={
          toggling?.active
            ? "New subscribers can no longer choose it. Stores already on it keep paying it."
            : "It becomes the active price for its currency and interval, replacing the current one for new subscribers."
        }
        confirmLabel={toggling?.active ? "Retire" : "Reactivate"}
        destructive={toggling?.active === true}
        pending={update.isPending}
        onConfirm={() => (toggling ? void toggle(toggling) : undefined)}
      />
    </div>
  )
}

const addSchema = z.object({
  currency_code: z.string({ error: "Choose a currency." }).length(3, "Choose a currency."),
  billing_interval: z.enum(["monthly", "yearly"]),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,4})?$/, "Enter an amount like 20 or 19.99.")
    .refine((v) => Number(v) > 0, "The amount must be more than zero."),
  trial_days: trialDays,
  trial_requires_payment_method: z.boolean(),
})

type AddValues = z.infer<typeof addSchema>

function AddPriceDialog({ plan, open, onOpenChange }: { plan: Plan; open: boolean; onOpenChange: (open: boolean) => void }) {
  const add = useAddPrice(plan.id)
  const currencies = useLookup("currencies")
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useForm<AddValues>({
    resolver: zodResolver(addSchema),
    defaultValues: { currency_code: "", billing_interval: "monthly", amount: "", trial_days: "", trial_requires_payment_method: false },
  })

  function close(next: boolean) {
    if (!next) {
      form.reset()
      setFormErrors([])
    }
    onOpenChange(next)
  }

  const currency = useWatch({ control: form.control, name: "currency_code" })
  const interval = useWatch({ control: form.control, name: "billing_interval" })
  const replaces = plan.prices.find((p) => p.active && p.currency === currency && p.interval === interval)

  async function onSubmit(values: AddValues) {
    setFormErrors([])
    try {
      await add.mutateAsync({ ...values, amount: Number(values.amount), trial_days: trialValue(values.trial_days) })
      toast.add({ title: "Price added", type: "success" })
      close(false)
    } catch (error) {
      setFormErrors(applyApiErrors(form, error))
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={close}>
      <ResponsiveDialogContent className="sm:max-w-lg">
        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Add a price</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>For {plan.name}. It becomes the active price for its currency and interval.</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <FormErrors messages={formErrors} />
          <FieldGroup>
            <div className="grid gap-6 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="currency_code"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor="currency_code">Currency</FieldLabel>
                    <StaticCombobox
                      id="currency_code"
                      options={currencies.data ?? []}
                      loading={currencies.isPending}
                      value={field.value || null}
                      onChange={(v) => field.onChange(v ?? "")}
                      placeholder="Search currencies"
                      invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="billing_interval"
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="billing_interval">Billed</FieldLabel>
                    <NativeSelect id="billing_interval" value={field.value} onChange={(e) => field.onChange(e.target.value)}>
                      <NativeSelectOption value="monthly">Monthly</NativeSelectOption>
                      <NativeSelectOption value="yearly">Yearly</NativeSelectOption>
                    </NativeSelect>
                  </Field>
                )}
              />
            </div>
            <Controller
              control={form.control}
              name="amount"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="amount">Amount</FieldLabel>
                  <Input {...field} id="amount" inputMode="decimal" autoComplete="off" aria-invalid={fieldState.invalid || undefined} />
                  <FieldDescription>Can&apos;t be changed later.</FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="trial_days"
              render={({ field, fieldState }) => <TrialDaysField value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error} />}
            />
            <Controller
              control={form.control}
              name="trial_requires_payment_method"
              render={({ field }) => <TrialCardField checked={field.value} onChange={field.onChange} />}
            />
          </FieldGroup>
          {replaces ? (
            <Alert>
              <Icon name="info" />
              <AlertDescription>
                This replaces the active {currency} {interval} price of {formatMoney(replaces.amount, replaces.currency)} for new subscribers.
              </AlertDescription>
            </Alert>
          ) : null}
          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={add.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={add.isPending}>
              {add.isPending ? <Spinner data-icon="inline-start" /> : null}
              Add price
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

const trialSchema = z.object({ trial_days: trialDays, trial_requires_payment_method: z.boolean() })
type TrialValues = z.infer<typeof trialSchema>

function TrialDialog({ plan, price, onClose }: { plan: Plan; price: PlanPrice | null; onClose: () => void }) {
  return (
    <ResponsiveDialog open={price !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <ResponsiveDialogContent className="sm:max-w-md">{price ? <TrialForm key={price.id} plan={plan} price={price} onDone={onClose} /> : null}</ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

function TrialForm({ plan, price, onDone }: { plan: Plan; price: PlanPrice; onDone: () => void }) {
  const update = useUpdatePrice(plan.id)
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useForm<TrialValues>({
    resolver: zodResolver(trialSchema),
    defaultValues: { trial_days: price.trialDays === null ? "" : String(price.trialDays), trial_requires_payment_method: price.trialRequiresCard },
  })

  async function onSubmit(values: TrialValues) {
    setFormErrors([])
    try {
      await update.mutateAsync({ priceId: price.id, body: { ...values, trial_days: trialValue(values.trial_days) } })
      toast.add({ title: "Trial updated", type: "success" })
      onDone()
    } catch (error) {
      setFormErrors(applyApiErrors(form, error))
    }
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>Trial for {formatMoney(price.amount, price.currency)} {INTERVAL_LABELS[price.interval].toLowerCase()}</ResponsiveDialogTitle>
        <ResponsiveDialogDescription>Applies to new subscribers only.</ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      <FormErrors messages={formErrors} />
      <FieldGroup>
        <Controller
          control={form.control}
          name="trial_days"
          render={({ field, fieldState }) => <TrialDaysField value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error} />}
        />
        <Controller
          control={form.control}
          name="trial_requires_payment_method"
          render={({ field }) => <TrialCardField checked={field.value} onChange={field.onChange} />}
        />
      </FieldGroup>
      <ResponsiveDialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={update.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? <Spinner data-icon="inline-start" /> : null}
          Save trial
        </Button>
      </ResponsiveDialogFooter>
    </form>
  )
}

/** The trial-days input, shared by the add and trial forms (each binds it with its own Controller). */
function TrialDaysField({ value, onChange, onBlur, error }: { value: string; onChange: (v: string) => void; onBlur: () => void; error: FieldErrorType | undefined }) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor="trial_days">Trial days</FieldLabel>
      <Input
        id="trial_days"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        inputMode="numeric"
        placeholder="Platform default"
        className="w-40"
        aria-invalid={error ? true : undefined}
      />
      <FieldDescription>Leave empty to use the platform default. 0 means no trial.</FieldDescription>
      <FieldError errors={[error]} />
    </Field>
  )
}

function TrialCardField({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldTitle>Require a card for the trial</FieldTitle>
        <FieldDescription>The store adds a payment method before its trial starts.</FieldDescription>
      </FieldContent>
      <Switch checked={checked} onCheckedChange={onChange} aria-label="Require a card for the trial" />
    </Field>
  )
}
