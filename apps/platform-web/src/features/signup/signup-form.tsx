"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { isApiError, unwrap, type ApiError } from "@workspace/api-client"
import type { operations } from "@workspace/contract/landlord"
import { formatMoney } from "@workspace/format"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@workspace/ui/components/responsive-dialog"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { Icon } from "@workspace/ui/icons"

import { SITE_LOCALE, type LegalDocument } from "./model"
import { LookupCombobox } from "./lookup-combobox"
import { rememberSignupEmail } from "./signup-store"
import { api } from "@/shell/api-client"

type RegisterBody = operations["landlord.register.store"]["requestBody"]["content"]["application/json"]
type CouponResult = operations["landlord.platform-coupons.validate"]["responses"][200]["content"]["application/json"]["data"]

const COUPON_REASONS: Record<NonNullable<CouponResult["reason"]>, string> = {
  not_found: "This code doesn't exist.",
  inactive: "This code is no longer active.",
  not_started: "This code isn't active yet.",
  expired: "This code has expired.",
  not_applicable_to_price: "This code doesn't apply to the chosen plan.",
  currency_mismatch: "This code is for a different currency.",
  minimum_not_met: "The plan doesn't meet this code's minimum.",
  first_subscription_only: "This code is for first-time subscribers only.",
  usage_limit_reached: "This code has been fully redeemed.",
  tenant_limit_reached: "This code has already been used with this email.",
}

const schema = z
  .object({
    business_name: z.string().trim().min(2, "Enter your business name.").max(120),
    owner_name: z.string().trim().min(1, "Enter your name.").max(120),
    email: z.email("Enter a valid email address."),
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .regex(/[A-Za-z]/, "Include at least one letter.")
      .regex(/\d/, "Include at least one number."),
    password_confirmation: z.string(),
    country_id: z.string({ error: "Choose your country." }).min(1, "Choose your country."),
    default_currency: z.string().nullable(),
    coupon_code: z.string().trim().max(32),
    accepted: z.record(z.string(), z.boolean()),
  })
  .refine((v) => v.password === v.password_confirmation, { path: ["password_confirmation"], message: "The passwords don't match." })

type Values = z.infer<typeof schema>
type FieldName = Exclude<keyof Values, "accepted">

const FIELDS: readonly FieldName[] = [
  "business_name",
  "owner_name",
  "email",
  "password",
  "password_confirmation",
  "country_id",
  "default_currency",
  "coupon_code",
]

type Problem = { title: string; body: string }

/**
 * Step 2 of tenant sign-up (spec §24.3): business and owner details,
 * country, optional currency and coupon, and one checkbox per required
 * legal document. Submits POST /api/register and moves to verification.
 */
export function SignupForm({
  priceId,
  planSummary,
  documents,
  referral,
}: {
  priceId: number
  planSummary: { name: string; amount: string; currency: string; interval: string; trialDays: number }
  documents: LegalDocument[]
  referral: string | null
}) {
  const router = useRouter()
  const [problem, setProblem] = useState<Problem | null>(null)
  const [reading, setReading] = useState<LegalDocument | null>(null)
  const [coupon, setCoupon] = useState<{ code: string; result: CouponResult } | null>(null)
  const required = documents.filter((d) => d.required_at_registration)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      business_name: "",
      owner_name: "",
      email: "",
      password: "",
      password_confirmation: "",
      country_id: "",
      default_currency: null,
      coupon_code: "",
      accepted: Object.fromEntries(required.map((d) => [String(d.id), false])),
    },
  })

  const email = useWatch({ control: form.control, name: "email" })
  const couponCode = useWatch({ control: form.control, name: "coupon_code" })

  const validateCoupon = useMutation({
    mutationFn: async (code: string) =>
      unwrap(api.POST("/platform-coupons/validate", { body: { code, plan_price_id: priceId, email: email.includes("@") ? email : null } })),
    onSuccess: (result, code) => {
      setCoupon({ code, result })
      if (result.valid) form.clearErrors("coupon_code")
      else form.setError("coupon_code", { type: "server", message: (result.reason && COUPON_REASONS[result.reason]) ?? "This code can't be used." })
    },
    onError: () => form.setError("coupon_code", { type: "server", message: "We couldn't check this code. Try again." }),
  })

  const register = useMutation({
    mutationFn: async (body: RegisterBody) => unwrap(api.POST("/register", { body })),
    onSuccess: (data, body) => {
      rememberSignupEmail(data.registration_id, body.email)
      router.push(`/register/verify?registration=${encodeURIComponent(data.registration_id)}`)
    },
    onError: (error) => handleError(error),
  })

  function handleError(error: Error) {
    if (!isApiError(error)) {
      setProblem({ title: "Something went wrong", body: "Try again in a moment." })
      return
    }
    const apiError: ApiError = error

    switch (apiError.code) {
      case "registration_unavailable":
        setProblem({ title: "Sign-ups are paused", body: "New stores can't be created right now. Please try again later." })
        return
      case "coupon_invalid":
        form.setError("coupon_code", { type: "server", message: "This code can't be applied to this sign-up." })
        return
      case "legal_version_outdated":
        setProblem({ title: "Our terms were updated", body: "Please review and accept the latest documents." })
        form.setValue("accepted", Object.fromEntries(required.map((d) => [String(d.id), false])))
        router.refresh()
        return
      case "network_error":
        setProblem({ title: "You appear to be offline", body: "Check your connection and try again." })
        return
    }

    if (apiError.status === 429) {
      setProblem({ title: "Too many attempts", body: "Please wait a minute and try again." })
      return
    }

    let mapped = false
    for (const [key, messages] of Object.entries(apiError.fieldErrors)) {
      const name = FIELDS.find((f) => f === key)
      if (name) {
        form.setError(name, { type: "server", message: messages.join(" ") })
        mapped = true
      } else if (key.startsWith("accepted_legal_document_ids")) {
        setProblem({ title: "Accept the documents", body: messages.join(" ") })
        mapped = true
      } else if (key === "plan_price_id") {
        setProblem({ title: "This plan isn't available", body: "Go back to pricing and choose another plan." })
        mapped = true
      }
    }
    if (!mapped) setProblem({ title: "We couldn't create your store", body: apiError.message || "Try again in a moment." })
  }

  function onSubmit(values: Values) {
    setProblem(null)
    const missing = required.filter((d) => !values.accepted[String(d.id)])
    if (missing.length > 0) {
      for (const d of missing) form.setError(`accepted.${d.id}`, { type: "required", message: `Accept the ${d.title}.` })
      return
    }

    register.mutate({
      business_name: values.business_name,
      owner_name: values.owner_name,
      email: values.email,
      password: values.password,
      password_confirmation: values.password_confirmation,
      country_id: Number(values.country_id),
      default_currency: values.default_currency,
      plan_price_id: priceId,
      accepted_legal_document_ids: required.map((d) => d.id),
      coupon_code: values.coupon_code || null,
      ref: referral,
    })
  }

  const appliedCoupon = coupon?.result.valid && coupon.code === couponCode.trim() ? coupon.result : null
  const submitting = register.isPending

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-8">
      {problem ? (
        <Alert variant="destructive">
          <Icon name="error" />
          <AlertTitle>{problem.title}</AlertTitle>
          <AlertDescription>{problem.body}</AlertDescription>
        </Alert>
      ) : null}

      <FieldSet>
        <FieldLegend>Your store</FieldLegend>
        <FieldGroup>
          <TextField form={form} name="business_name" label="Business name" autoComplete="organization" description="Your store's address is made from this name." />
          <Controller
            control={form.control}
            name="country_id"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor="country_id">Country</FieldLabel>
                <LookupCombobox lookup="countries" id="country_id" value={field.value || null} onChange={(v) => field.onChange(v ?? "")} invalid={fieldState.invalid} placeholder="Search countries…" />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="default_currency"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor="default_currency">Store currency (optional)</FieldLabel>
                <LookupCombobox lookup="currencies" id="default_currency" value={field.value} onChange={field.onChange} invalid={fieldState.invalid} placeholder="Your country's currency" clearable />
                <FieldDescription>Leave empty to use your country&apos;s currency.</FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Your account</FieldLegend>
        <FieldGroup>
          <TextField form={form} name="owner_name" label="Your name" autoComplete="name" />
          <TextField form={form} name="email" label="Email" type="email" autoComplete="email" description="We'll send a verification code here." />
          <div className="grid gap-6 sm:grid-cols-2">
            <TextField form={form} name="password" label="Password" type="password" autoComplete="new-password" description="At least 8 characters with a letter and a number." />
            <TextField form={form} name="password_confirmation" label="Confirm password" type="password" autoComplete="new-password" />
          </div>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Coupon</FieldLegend>
        <Controller
          control={form.control}
          name="coupon_code"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="coupon_code">Coupon code (optional)</FieldLabel>
              <div className="flex gap-2">
                <Input {...field} id="coupon_code" autoComplete="off" className="uppercase" aria-invalid={fieldState.invalid || undefined} />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!field.value.trim() || validateCoupon.isPending}
                  onClick={() => validateCoupon.mutate(field.value.trim())}
                >
                  {validateCoupon.isPending ? <Spinner data-icon="inline-start" /> : null}
                  Apply
                </Button>
              </div>
              {appliedCoupon ? (
                <FieldDescription className="text-primary">
                  <Icon name="success" className="mr-1 inline size-4 align-text-bottom" />
                  {appliedCoupon.description ?? "Coupon applied."}
                  {appliedCoupon.discount ? ` You save ${formatMoney(appliedCoupon.discount, appliedCoupon.currency_code, SITE_LOCALE)}.` : ""}
                </FieldDescription>
              ) : null}
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldSet>

      {required.length > 0 ? (
        <FieldSet>
          <FieldLegend>Agreements</FieldLegend>
          <FieldGroup className="gap-3">
            {required.map((doc) => (
              <Controller
                key={doc.id}
                control={form.control}
                name={`accepted.${doc.id}`}
                render={({ field, fieldState }) => (
                  <Field orientation="horizontal" data-invalid={fieldState.invalid || undefined}>
                    <Checkbox
                      id={`legal-${doc.id}`}
                      checked={field.value === true}
                      onCheckedChange={(checked) => {
                        field.onChange(checked === true)
                        if (checked) form.clearErrors(`accepted.${doc.id}`)
                      }}
                      aria-invalid={fieldState.invalid || undefined}
                    />
                    <FieldContent>
                      <FieldLabel htmlFor={`legal-${doc.id}`} className="font-normal">
                        I accept the {doc.title}
                      </FieldLabel>
                      <button type="button" className="w-fit text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground" onClick={() => setReading(doc)}>
                        Read the {doc.title}
                      </button>
                      <FieldError errors={[fieldState.error]} />
                    </FieldContent>
                  </Field>
                )}
              />
            ))}
          </FieldGroup>
        </FieldSet>
      ) : null}

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" disabled={submitting} className="w-full">
          {submitting ? <Spinner data-icon="inline-start" /> : null}
          {submitting ? "Creating your store…" : planSummary.trialDays > 0 ? "Start my free trial" : "Continue"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {planSummary.name} · {formatMoney(planSummary.amount, planSummary.currency, SITE_LOCALE)} / {planSummary.interval}
          {planSummary.trialDays > 0 ? ` after your ${planSummary.trialDays}-day trial` : ""}
        </p>
      </div>

      <ResponsiveDialog open={reading !== null} onOpenChange={(open) => (open ? null : setReading(null))}>
        <ResponsiveDialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{reading?.title}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Version {reading?.version}</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="text-sm whitespace-pre-wrap">{reading?.body}</div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </form>
  )
}

function TextField({
  form,
  name,
  label,
  description,
  type = "text",
  autoComplete,
}: {
  form: ReturnType<typeof useForm<Values>>
  name: "business_name" | "owner_name" | "email" | "password" | "password_confirmation"
  label: string
  description?: string
  type?: "text" | "email" | "password"
  autoComplete?: string
}) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Input {...field} id={name} type={type} autoComplete={autoComplete} aria-invalid={fieldState.invalid || undefined} />
          {description ? <FieldDescription>{description}</FieldDescription> : null}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}
