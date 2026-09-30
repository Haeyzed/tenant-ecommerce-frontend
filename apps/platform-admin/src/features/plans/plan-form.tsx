"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { FormErrors, applyApiErrors } from "@workspace/admin-kit/forms"
import { isApiError } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"

import { useCreatePlan, useUpdatePlan, type Plan, type PlanBody } from "./api"

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(120),
  slug: z
    .string()
    .trim()
    .max(120)
    .regex(/^[a-z0-9_-]*$/, "Use lowercase letters, numbers, dashes and underscores."),
  tagline: z.string().trim().max(255),
  description: z.string().trim().max(2000),
  marketing_badge: z.string().trim().max(80),
  is_public: z.boolean(),
  is_recommended: z.boolean(),
  sort_order: z.coerce.number<string>().int().min(0).max(10000),
})

type Values = z.input<typeof schema>
type Parsed = z.output<typeof schema>

function defaults(plan: Plan | null): Values {
  return {
    name: plan?.name ?? "",
    slug: plan?.slug ?? "",
    tagline: plan?.tagline ?? "",
    description: plan?.description ?? "",
    marketing_badge: plan?.badge ?? "",
    is_public: plan?.public ?? true,
    is_recommended: plan?.recommended ?? false,
    sort_order: String(plan?.sortOrder ?? 0),
  }
}

const orNull = (v: string) => (v === "" ? null : v)

/**
 * A plan's name, marketing copy and visibility. Creating leaves the plan
 * inactive so prices and features can be set before stores can buy it.
 */
export function PlanForm({ plan }: { plan: Plan | null }) {
  const router = useRouter()
  const create = useCreatePlan()
  const update = useUpdatePlan(plan?.id ?? 0)
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useForm<Values, unknown, Parsed>({ resolver: zodResolver(schema), defaultValues: defaults(plan) })

  async function onSubmit(values: Parsed) {
    setFormErrors([])
    const body: PlanBody = {
      name: values.name,
      tagline: orNull(values.tagline),
      description: orNull(values.description),
      marketing_badge: orNull(values.marketing_badge),
      is_public: values.is_public,
      is_recommended: values.is_recommended,
      sort_order: values.sort_order,
      ...(values.slug ? { slug: values.slug } : {}),
    }

    try {
      if (plan === null) {
        const created = await create.mutateAsync({ ...body, name: values.name, is_active: false })
        toast.add({ title: `${created.name} created`, description: "Add prices, then activate it.", type: "success" })
        router.push(`/plans/${created.id}?tab=prices`)
      } else {
        const saved = await update.mutateAsync(body)
        form.reset(defaults(saved))
        toast.add({ title: "Plan saved", type: "success" })
      }
    } catch (error) {
      setFormErrors(isApiError(error) && error.code === "plan_limits_incomplete" ? [error.message] : applyApiErrors(form, error))
    }
  }

  const pending = create.isPending || update.isPending

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex max-w-2xl flex-col gap-6">
      <FormErrors messages={formErrors} />
      <FieldGroup>
        <div className="grid gap-6 sm:grid-cols-2">
          <TextField form={form} name="name" label="Name" />
          <TextField
            form={form}
            name="slug"
            label="Slug"
            description={plan === null ? "Optional. Made from the name when empty." : "Used in pricing URLs. Changing it breaks existing links."}
          />
        </div>
        <TextField form={form} name="tagline" label="Tagline" description="One short line under the plan name on the pricing page." />
        <Controller
          control={form.control}
          name="description"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea {...field} id="description" rows={3} aria-invalid={fieldState.invalid || undefined} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <div className="grid gap-6 sm:grid-cols-2">
          <TextField form={form} name="marketing_badge" label="Badge" description="For example “Most popular”. Shown on the recommended plan." />
          <TextField form={form} name="sort_order" label="Order" type="number" description="Lower numbers appear first." />
        </div>
        <SwitchField form={form} name="is_public" title="Show on the pricing page" description="Hidden plans can still be assigned by the platform team." />
        <SwitchField form={form} name="is_recommended" title="Recommended plan" description="Highlighted on the pricing page. Only one active public plan can be recommended." />
      </FieldGroup>

      <div className="flex justify-end gap-2 border-t pt-4">
        {plan === null ? (
          <Button type="button" variant="outline" onClick={() => router.push("/plans")} disabled={pending}>
            Cancel
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={() => form.reset(defaults(plan))} disabled={pending || !form.formState.isDirty}>
            Discard changes
          </Button>
        )}
        <Button type="submit" disabled={pending || (plan !== null && !form.formState.isDirty)}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {plan === null ? "Create plan" : "Save changes"}
        </Button>
      </div>
    </form>
  )
}

type Form = ReturnType<typeof useForm<Values, unknown, Parsed>>

function TextField({
  form,
  name,
  label,
  description,
  type = "text",
}: {
  form: Form
  name: "name" | "slug" | "tagline" | "marketing_badge" | "sort_order"
  label: string
  description?: string
  type?: "text" | "number"
}) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Input {...field} id={name} type={type} inputMode={type === "number" ? "numeric" : undefined} aria-invalid={fieldState.invalid || undefined} />
          {description ? <FieldDescription>{description}</FieldDescription> : null}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

function SwitchField({ form, name, title, description }: { form: Form; name: "is_public" | "is_recommended"; title: string; description: string }) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <Field orientation="horizontal" data-invalid={fieldState.invalid || undefined}>
          <FieldContent>
            <FieldTitle>{title}</FieldTitle>
            <FieldDescription>{description}</FieldDescription>
            <FieldError errors={[fieldState.error]} />
          </FieldContent>
          <Switch id={name} checked={field.value} onCheckedChange={field.onChange} aria-label={title} />
        </Field>
      )}
    />
  )
}
