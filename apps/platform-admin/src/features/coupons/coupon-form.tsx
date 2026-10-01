"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { FormErrors, applyApiErrors } from "@workspace/admin-kit/forms"
import { MultiCombobox, StaticCombobox } from "@workspace/admin-kit/lookup"
import { isApiError } from "@workspace/api-client"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select"
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "@workspace/ui/components/toast"
import { Icon } from "@workspace/ui/icons"

import { useLookup } from "@/features/lookups"
import { plansQuery } from "@/features/plans/api"

import { useSaveCoupon, type Coupon, type CouponBody } from "./api"

const decimal = (message: string) => z.string().trim().regex(/^(\d+(\.\d{1,4})?)?$/, message)
const wholeOrEmpty = z.string().trim().regex(/^\d*$/, "Enter a whole number.")

const schema = z
  .object({
    code: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9-]{4,32}$/, "4 to 32 letters, numbers or dashes.")),
    name: z.string().trim().min(1, "Enter a name.").max(255),
    description: z.string().trim().max(255),
    discount_type: z.enum(["percentage", "fixed_amount"]),
    discount_value: decimal("Enter a number like 20 or 19.99."),
    currency_code: z.string(),
    duration: z.enum(["once", "repeating"]),
    duration_cycles: wholeOrEmpty,
    max_discount_amount: decimal("Enter an amount like 50 or 49.99."),
    min_amount: decimal("Enter an amount like 10 or 9.99."),
    first_subscription_only: z.boolean(),
    usage_limit_total: wholeOrEmpty,
    usage_limit_per_tenant: z.string().trim().regex(/^[1-9]\d*$/, "Enter 1 or more."),
    starts_at: z.string(),
    ends_at: z.string(),
    applies_to: z.enum(["all", "plans"]),
    plan_ids: z.array(z.string()),
    is_active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const value = Number(v.discount_value)
    if (!v.discount_value || value <= 0) ctx.addIssue({ code: "custom", path: ["discount_value"], message: "Enter a discount greater than zero." })
    if (v.discount_type === "percentage" && value > 100) ctx.addIssue({ code: "custom", path: ["discount_value"], message: "A percentage can be at most 100." })
    if (v.discount_type === "fixed_amount" && !v.currency_code) ctx.addIssue({ code: "custom", path: ["currency_code"], message: "Choose the currency of the amount." })
    if (v.duration === "repeating") {
      const cycles = Number(v.duration_cycles)
      if (!v.duration_cycles || cycles < 2 || cycles > 36) ctx.addIssue({ code: "custom", path: ["duration_cycles"], message: "Enter 2 to 36 payments." })
    }
    if (v.usage_limit_total && Number(v.usage_limit_total) < 1) ctx.addIssue({ code: "custom", path: ["usage_limit_total"], message: "Enter 1 or more, or leave empty." })
    if (v.starts_at && v.ends_at && v.ends_at <= v.starts_at) ctx.addIssue({ code: "custom", path: ["ends_at"], message: "The end must be after the start." })
    if (v.applies_to === "plans" && v.plan_ids.length === 0) ctx.addIssue({ code: "custom", path: ["plan_ids"], message: "Choose at least one plan." })
  })

type Values = z.input<typeof schema>
type Parsed = z.output<typeof schema>

/** ISO instant → value for a datetime-local input, in the browser's time zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const fromLocalInput = (value: string): string | null => (value ? new Date(value).toISOString() : null)
const orNull = (v: string) => (v === "" ? null : v)
const numOrNull = (v: string) => (v === "" ? null : Number(v))

function defaults(coupon: Coupon | null): Values {
  const planIds = (coupon?.targets ?? []).filter((t) => t.target_type === "plan").map((t) => String(t.target_id))
  return {
    code: coupon?.code ?? "",
    name: coupon?.name ?? "",
    description: coupon?.description ?? "",
    discount_type: coupon?.discount_type === "fixed_amount" ? "fixed_amount" : "percentage",
    discount_value: coupon ? String(Number(coupon.discount_value)) : "",
    currency_code: coupon?.currency_code ?? "",
    duration: coupon?.duration === "repeating" ? "repeating" : "once",
    duration_cycles: coupon?.duration_cycles ? String(coupon.duration_cycles) : "",
    max_discount_amount: coupon?.max_discount_amount ? String(Number(coupon.max_discount_amount)) : "",
    min_amount: coupon?.min_amount ? String(Number(coupon.min_amount)) : "",
    first_subscription_only: coupon?.first_subscription_only ?? false,
    usage_limit_total: coupon?.usage_limit_total ? String(coupon.usage_limit_total) : "",
    usage_limit_per_tenant: String(coupon?.usage_limit_per_tenant ?? 1),
    starts_at: toLocalInput(coupon?.starts_at ?? null),
    ends_at: toLocalInput(coupon?.ends_at ?? null),
    applies_to: planIds.length > 0 ? "plans" : "all",
    plan_ids: planIds,
    is_active: coupon?.is_active ?? true,
  }
}

/**
 * Create or edit a platform coupon (spec §25.1, §14.8). Once redeemed, the
 * discount itself (type, value, currency, duration) is locked by the
 * backend, so those fields are disabled.
 */
export function CouponForm({ coupon }: { coupon: Coupon | null }) {
  const router = useRouter()
  const save = useSaveCoupon(coupon?.id ?? null)
  const plans = useQuery(plansQuery)
  const currencies = useLookup("currencies")
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useForm<Values, unknown, Parsed>({ resolver: zodResolver(schema), defaultValues: defaults(coupon) })

  const discountType = useWatch({ control: form.control, name: "discount_type" })
  const duration = useWatch({ control: form.control, name: "duration" })
  const appliesTo = useWatch({ control: form.control, name: "applies_to" })
  const locked = (coupon?.times_redeemed ?? 0) > 0

  async function onSubmit(values: Parsed) {
    setFormErrors([])
    // Price-level targets are kept as they are; this form edits plan targets.
    const priceTargets = (coupon?.targets ?? []).filter((t) => t.target_type === "plan_price").map((t) => ({ target_type: "plan_price" as const, target_id: t.target_id }))
    const body: CouponBody = {
      code: values.code,
      name: values.name,
      description: orNull(values.description),
      discount_type: values.discount_type,
      discount_value: Number(values.discount_value),
      currency_code: values.discount_type === "fixed_amount" ? values.currency_code : null,
      duration: values.duration,
      duration_cycles: values.duration === "repeating" ? numOrNull(values.duration_cycles) : null,
      max_discount_amount: values.discount_type === "percentage" ? numOrNull(values.max_discount_amount) : null,
      min_amount: numOrNull(values.min_amount),
      first_subscription_only: values.first_subscription_only,
      usage_limit_total: numOrNull(values.usage_limit_total),
      usage_limit_per_tenant: Number(values.usage_limit_per_tenant),
      starts_at: fromLocalInput(values.starts_at),
      ends_at: fromLocalInput(values.ends_at),
      is_active: values.is_active,
      targets: values.applies_to === "plans" ? [...values.plan_ids.map((id) => ({ target_type: "plan" as const, target_id: Number(id) })), ...priceTargets] : priceTargets,
    }

    try {
      const saved = await save.mutateAsync(body)
      toast.add({ title: coupon ? "Coupon saved" : `Coupon ${values.code} created`, type: "success" })
      router.push(`/platform-coupons/${saved.id}`)
    } catch (error) {
      if (isApiError(error) && error.code === "coupon_redeemed") {
        setFormErrors(["The discount can't change once the coupon has been redeemed. Create a new coupon instead."])
        return
      }
      setFormErrors(applyApiErrors(form, error))
    }
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex max-w-3xl flex-col gap-8">
      <FormErrors messages={formErrors} />

      <FieldSet>
        <FieldLegend>Coupon</FieldLegend>
        <FieldGroup>
          <div className="grid gap-6 sm:grid-cols-2">
            <TextField form={form} name="code" label="Code" disabled={coupon !== null} description={coupon ? "Codes can't be changed." : "What stores type at sign-up. Letters, numbers and dashes."} className="uppercase" />
            <TextField form={form} name="name" label="Name" description="Shown to the platform team only." />
          </div>
          <TextField form={form} name="description" label="Description" description="Shown to stores when the code is applied, e.g. “Launch offer”." />
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Discount</FieldLegend>
        {locked ? (
          <Alert>
            <Icon name="info" />
            <AlertDescription>This coupon has been redeemed, so its discount is locked. Create a new coupon to offer a different discount.</AlertDescription>
          </Alert>
        ) : null}
        <FieldGroup>
          <Controller
            control={form.control}
            name="discount_type"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={(v) => field.onChange(v === "fixed_amount" ? "fixed_amount" : "percentage")} disabled={locked} className="grid gap-3 sm:grid-cols-2">
                <ChoiceCard id="type-percentage" value="percentage" title="Percentage" description="A share of the plan price." />
                <ChoiceCard id="type-fixed" value="fixed_amount" title="Fixed amount" description="A set amount in one currency." />
              </RadioGroup>
            )}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <TextField form={form} name="discount_value" label={discountType === "percentage" ? "Percent off" : "Amount off"} disabled={locked} inputMode="decimal" />
            {discountType === "fixed_amount" ? (
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
                      disabled={locked}
                      invalid={fieldState.invalid}
                      placeholder="Search currencies"
                    />
                    <FieldDescription>Only plans billed in this currency can use the coupon.</FieldDescription>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            ) : (
              <TextField form={form} name="max_discount_amount" label="Maximum discount (optional)" inputMode="decimal" description="Caps the discount in the plan's currency." />
            )}
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="duration"
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="duration">Applies to</FieldLabel>
                  <NativeSelect id="duration" value={field.value} disabled={locked} onChange={(e) => field.onChange(e.target.value === "repeating" ? "repeating" : "once")}>
                    <NativeSelectOption value="once">The first payment</NativeSelectOption>
                    <NativeSelectOption value="repeating">Several payments</NativeSelectOption>
                  </NativeSelect>
                </Field>
              )}
            />
            {duration === "repeating" ? <TextField form={form} name="duration_cycles" label="Number of payments" disabled={locked} inputMode="numeric" description="2 to 36 billing cycles." /> : null}
          </div>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Eligibility</FieldLegend>
        <FieldGroup>
          <Controller
            control={form.control}
            name="applies_to"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={(v) => field.onChange(v === "plans" ? "plans" : "all")} className="grid gap-3 sm:grid-cols-2">
                <ChoiceCard id="applies-all" value="all" title="Every plan" description="Any plan and billing interval." />
                <ChoiceCard id="applies-plans" value="plans" title="Specific plans" description="Only the plans you choose." />
              </RadioGroup>
            )}
          />
          {appliesTo === "plans" ? (
            <Controller
              control={form.control}
              name="plan_ids"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="plan_ids">Plans</FieldLabel>
                  <MultiCombobox
                    id="plan_ids"
                    options={(plans.data ?? []).map((p) => ({ value: String(p.id), label: p.active ? p.name : `${p.name} (inactive)` }))}
                    loading={plans.isPending}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Search plans"
                    invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          ) : null}
          <div className="grid gap-6 sm:grid-cols-2">
            <TextField form={form} name="min_amount" label="Minimum plan price (optional)" inputMode="decimal" />
            <TextField form={form} name="usage_limit_total" label="Total redemptions (optional)" inputMode="numeric" description="Leave empty for no limit." />
            <TextField form={form} name="usage_limit_per_tenant" label="Redemptions per store" inputMode="numeric" />
          </div>
          <SwitchField form={form} name="first_subscription_only" title="New stores only" description="Only for a store's first paid subscription." />
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Schedule</FieldLegend>
        <FieldGroup>
          <div className="grid gap-6 sm:grid-cols-2">
            <TextField form={form} name="starts_at" label="Starts (optional)" type="datetime-local" description="Leave empty to start now." />
            <TextField form={form} name="ends_at" label="Ends (optional)" type="datetime-local" description="Leave empty to run until deactivated." />
          </div>
          <SwitchField form={form} name="is_active" title="Active" description="Inactive coupons are refused at sign-up and checkout." />
        </FieldGroup>
      </FieldSet>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background/95 py-3 backdrop-blur">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Spinner data-icon="inline-start" /> : null}
          {coupon ? "Save coupon" : "Create coupon"}
        </Button>
      </div>
    </form>
  )
}

type Form = ReturnType<typeof useForm<Values, unknown, Parsed>>
type TextName = "code" | "name" | "description" | "discount_value" | "duration_cycles" | "max_discount_amount" | "min_amount" | "usage_limit_total" | "usage_limit_per_tenant" | "starts_at" | "ends_at"

function TextField({
  form,
  name,
  label,
  description,
  disabled,
  type = "text",
  inputMode,
  className,
}: {
  form: Form
  name: TextName
  label: string
  description?: string
  disabled?: boolean
  type?: "text" | "datetime-local"
  inputMode?: "decimal" | "numeric"
  className?: string
}) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Input {...field} id={name} type={type} inputMode={inputMode} disabled={disabled} className={className} aria-invalid={fieldState.invalid || undefined} />
          {description ? <FieldDescription>{description}</FieldDescription> : null}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

function SwitchField({ form, name, title, description }: { form: Form; name: "first_subscription_only" | "is_active"; title: string; description: string }) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <Field orientation="horizontal">
          <FieldContent>
            <FieldTitle>{title}</FieldTitle>
            <FieldDescription>{description}</FieldDescription>
          </FieldContent>
          <Switch checked={field.value} onCheckedChange={field.onChange} aria-label={title} />
        </Field>
      )}
    />
  )
}

function ChoiceCard({ id, value, title, description }: { id: string; value: string; title: string; description: string }) {
  return (
    <FieldLabel htmlFor={id}>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldTitle>{title}</FieldTitle>
          <FieldDescription>{description}</FieldDescription>
        </FieldContent>
        <RadioGroupItem id={id} value={value} />
      </Field>
    </FieldLabel>
  )
}
