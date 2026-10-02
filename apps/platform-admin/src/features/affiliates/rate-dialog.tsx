"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { FormErrors, applyApiErrors } from "@workspace/admin-kit/forms"
import { formatPercent } from "@workspace/format"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"

import { useSetCommissionRate, type Affiliate } from "./api"

const schema = z.object({
  commission_rate: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{1,3}(\.\d{1,4})?$/.test(v) && Number(v) <= 100), "Enter a rate from 0 to 100, or leave it empty."),
  reason: z.string().trim().min(1, "Give a reason. It is kept with the affiliate's history.").max(255),
})
type Values = z.infer<typeof schema>

/** A custom commission rate, or back to the platform default (empty). Existing commissions keep their rate. */
export function RateDialog({ id, affiliate, open, onClose }: { id: number; affiliate: Affiliate; open: boolean; onClose: () => void }) {
  return (
    <ResponsiveDialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <ResponsiveDialogContent className="sm:max-w-md">{open ? <RateForm id={id} affiliate={affiliate} onDone={onClose} /> : null}</ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

function RateForm({ id, affiliate, onDone }: { id: number; affiliate: Affiliate; onDone: () => void }) {
  const save = useSetCommissionRate(id)
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { commission_rate: affiliate.commission_rate ? String(Number(affiliate.commission_rate)) : "", reason: "" },
  })

  async function onSubmit(values: Values) {
    setFormErrors([])
    try {
      const updated = await save.mutateAsync({ commission_rate: values.commission_rate === "" ? null : Number(values.commission_rate), reason: values.reason })
      toast.add({ title: `Commission rate is now ${formatPercent(updated.effective_commission_rate)}`, description: "It applies to new commissions.", type: "success" })
      onDone()
    } catch (error) {
      setFormErrors(applyApiErrors(form, error))
    }
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>Commission rate for {affiliate.name}</ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          Applies to commissions earned from now on. Commissions already earned keep the rate they were created with.
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      <FormErrors messages={formErrors} />
      <FieldGroup>
        <Controller
          control={form.control}
          name="commission_rate"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="rate">Rate</FieldLabel>
              <InputGroup className="w-36">
                <InputGroupInput {...field} id="rate" inputMode="decimal" placeholder="Default" aria-invalid={fieldState.invalid || undefined} />
                <InputGroupAddon align="inline-end">%</InputGroupAddon>
              </InputGroup>
              <FieldDescription>Leave empty to use the platform default rate.</FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="reason"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="rate-reason">Reason</FieldLabel>
              <Textarea {...field} id="rate-reason" rows={3} maxLength={255} aria-invalid={fieldState.invalid || undefined} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>
      <ResponsiveDialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Spinner data-icon="inline-start" /> : null}
          Save rate
        </Button>
      </ResponsiveDialogFooter>
    </form>
  )
}
