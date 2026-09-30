"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { FormErrors, applyApiErrors } from "@workspace/admin-kit/forms"
import { MultiCombobox } from "@workspace/admin-kit/lookup"
import { isApiError } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"

import { useLookup } from "@/features/lookups"

import { PROVIDER_LABELS, WEBHOOK_SECRET_HINT, useSaveGateway, type Gateway, type GatewayBody } from "./api"

const schema = z.object({
  public_key: z.string().trim().max(255),
  secret_key: z.string().trim().max(1024),
  webhook_secret: z.string().trim().max(1024),
  supported_currencies: z.array(z.string()).min(1, "Choose at least one currency."),
  supported_country_ids: z.array(z.string()),
  sort_order: z.coerce.number<string>().int().min(0).max(1000),
})

type Values = z.input<typeof schema>
type Parsed = z.output<typeof schema>

/**
 * Enter or replace one gateway's credentials (spec §25.1, §15.10). Stored
 * secrets are never shown; an empty secret field keeps the stored value.
 * Saving new credentials makes the backend check them with the provider.
 */
export function CredentialsSheet({ gateway, onClose }: { gateway: Gateway | null; onClose: () => void }) {
  const isMobile = useIsMobile()

  return (
    <Sheet open={gateway !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <SheetContent side={isMobile ? "bottom" : "right"} className="max-h-[92svh] gap-0 data-[side=right]:max-h-none sm:max-w-md">
        {gateway ? <CredentialsForm key={`${gateway.provider}:${gateway.mode}`} gateway={gateway} onDone={onClose} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function CredentialsForm({ gateway, onDone }: { gateway: Gateway; onDone: () => void }) {
  const save = useSaveGateway()
  const currencies = useLookup("currencies")
  const countries = useLookup("countries")
  const [formErrors, setFormErrors] = useState<string[]>([])
  const label = `${PROVIDER_LABELS[gateway.provider]} (${gateway.mode})`

  const form = useForm<Values, unknown, Parsed>({
    resolver: zodResolver(schema),
    defaultValues: {
      public_key: "",
      secret_key: "",
      webhook_secret: "",
      supported_currencies: gateway.currencies,
      supported_country_ids: (gateway.countryIds ?? []).map(String),
      sort_order: String(gateway.sortOrder),
    },
  })

  async function onSubmit(values: Parsed) {
    setFormErrors([])
    if (!gateway.configured && !values.secret_key) {
      form.setError("secret_key", { type: "required", message: "Enter the secret key." })
      return
    }

    // Omitted secrets keep the stored ones; only what was typed is sent.
    const body: GatewayBody = {
      supported_currencies: values.supported_currencies,
      supported_country_ids: values.supported_country_ids.length > 0 ? values.supported_country_ids.map(Number) : null,
      sort_order: values.sort_order,
      ...(values.public_key ? { public_key: values.public_key } : {}),
      ...(values.secret_key ? { secret_key: values.secret_key } : {}),
      ...(values.webhook_secret ? { webhook_secret: values.webhook_secret } : {}),
    }

    try {
      await save.mutateAsync({ provider: gateway.provider, mode: gateway.mode, body })
      toast.add({ title: `${label} saved`, description: "The provider accepted the keys.", type: "success" })
      onDone()
    } catch (error) {
      if (isApiError(error) && error.code === "payment_mode_mismatch") {
        form.setError("secret_key", { type: "server", message: error.message })
        return
      }
      if (isApiError(error) && error.code === "gateway_credentials_invalid") {
        form.setError("secret_key", { type: "server", message: `The provider rejected these keys: ${error.message}` })
        return
      }
      setFormErrors(applyApiErrors(form, error))
    }
  }

  const webhookHint = WEBHOOK_SECRET_HINT[gateway.provider]
  const secretHint = gateway.hasSecretKey ? "A key is stored. Leave empty to keep it." : "Required."

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
      <SheetHeader>
        <SheetTitle>{gateway.configured ? `Update ${label}` : `Connect ${label}`}</SheetTitle>
        <SheetDescription>
          {gateway.mode === "test" ? "Use the keys from the provider's test dashboard." : "Use live keys. Real money moves once this gateway is enabled."}
        </SheetDescription>
      </SheetHeader>

      {/* Only the fields scroll; the header and the save bar stay in view. */}
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
        <FormErrors messages={formErrors} />
        <FieldGroup>
          <Controller
            control={form.control}
            name="public_key"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor="public_key">Public key</FieldLabel>
                <Input {...field} id="public_key" autoComplete="off" spellCheck={false} placeholder={gateway.publicKey ?? undefined} aria-invalid={fieldState.invalid || undefined} />
                <FieldDescription>{gateway.publicKey ? "Leave empty to keep the current key." : "Optional for some providers."}</FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <SecretField form={form} name="secret_key" label="Secret key" hint={secretHint} />
          {webhookHint ? (
            <SecretField
              form={form}
              name="webhook_secret"
              label="Webhook secret"
              hint={gateway.hasWebhookSecret ? `A secret is stored. Leave empty to keep it. ${webhookHint}` : webhookHint}
            />
          ) : null}
          <Controller
            control={form.control}
            name="supported_currencies"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor="supported_currencies">Currencies</FieldLabel>
                <MultiCombobox
                  id="supported_currencies"
                  options={currencies.data ?? []}
                  loading={currencies.isPending}
                  value={field.value}
                  onChange={field.onChange}
                  chipLabel={(o) => o.value}
                  placeholder="Search currencies"
                  invalid={fieldState.invalid}
                />
                <FieldDescription>Subscriptions in these currencies can be charged through this gateway.</FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="supported_country_ids"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor="supported_country_ids">Countries (optional)</FieldLabel>
                <MultiCombobox
                  id="supported_country_ids"
                  options={countries.data ?? []}
                  loading={countries.isPending}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="All countries"
                  invalid={fieldState.invalid}
                />
                <FieldDescription>Leave empty to offer this gateway to stores in every country.</FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="sort_order"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor="sort_order">Order</FieldLabel>
                <Input {...field} id="sort_order" type="number" inputMode="numeric" min={0} max={1000} className="w-28" aria-invalid={fieldState.invalid || undefined} />
                <FieldDescription>Lower numbers are offered first after the default gateway.</FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </FieldGroup>
      </div>

      <SheetFooter className="flex-col-reverse gap-2 border-t sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Spinner data-icon="inline-start" /> : null}
          {save.isPending ? "Checking with the provider…" : "Save credentials"}
        </Button>
      </SheetFooter>
    </form>
  )
}

function SecretField({
  form,
  name,
  label,
  hint,
}: {
  form: ReturnType<typeof useForm<Values, unknown, Parsed>>
  name: "secret_key" | "webhook_secret"
  label: string
  hint: string
}) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Input {...field} id={name} type="password" autoComplete="new-password" spellCheck={false} aria-invalid={fieldState.invalid || undefined} />
          <FieldDescription>{hint}</FieldDescription>
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}
