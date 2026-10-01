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
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"

import { DOCUMENT_TYPES, useSaveDraft, type DocumentType, type LegalDocument } from "./api"
import { typeLabel } from "./labels"

const schema = z.object({
  document_type: z.enum(["terms_of_service", "privacy_policy", "data_processing_agreement", "acceptable_use_policy", "affiliate_agreement"]),
  version: z.string().trim().min(1, "Enter a version, e.g. 2026-10.").max(32),
  title: z.string().trim().min(1, "Enter a title.").max(255),
  body: z.string().trim().min(1, "Enter the document text.").max(500000),
  effective_at: z.string(),
  required_at_registration: z.boolean(),
  requires_reacceptance: z.boolean(),
})
type Values = z.infer<typeof schema>

function defaults(doc: LegalDocument | null, type: DocumentType | null): Values {
  const known = DOCUMENT_TYPES.find((t) => t === doc?.document_type) ?? type ?? "terms_of_service"
  return {
    document_type: known,
    version: doc?.version ?? "",
    title: doc?.title ?? typeLabel(known),
    body: doc?.body ?? "",
    effective_at: doc?.effective_at ? doc.effective_at.slice(0, 10) : "",
    required_at_registration: doc?.required_at_registration ?? false,
    requires_reacceptance: doc?.requires_reacceptance ?? false,
  }
}

/** A new version or an unpublished draft (spec §11.6). Published versions are read-only. */
export function LegalForm({ doc, initialType = null }: { doc: LegalDocument | null; initialType?: DocumentType | null }) {
  const router = useRouter()
  const save = useSaveDraft(doc?.id ?? null)
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults(doc, initialType) })

  async function onSubmit(values: Values) {
    setFormErrors([])
    try {
      const saved = await save.mutateAsync({ ...values, effective_at: values.effective_at ? new Date(`${values.effective_at}T00:00:00`).toISOString() : null })
      toast.add({ title: doc ? "Draft saved" : "Draft created", description: "Publish it when it's ready.", type: "success" })
      router.push(`/legal-documents/${saved.id}`)
    } catch (error) {
      if (isApiError(error) && error.code === "legal_document_immutable") {
        setFormErrors(["This version has been published, so it can't change. Create a new version instead."])
        return
      }
      setFormErrors(applyApiErrors(form, error))
    }
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex max-w-4xl flex-col gap-6">
      <FormErrors messages={formErrors} />
      <FieldGroup>
        <div className="grid gap-6 sm:grid-cols-[1fr_12rem]">
          <Controller
            control={form.control}
            name="document_type"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="document_type">Document</FieldLabel>
                <NativeSelect
                  id="document_type"
                  value={field.value}
                  disabled={doc !== null}
                  onChange={(e) => field.onChange(DOCUMENT_TYPES.find((t) => t === e.target.value) ?? field.value)}
                >
                  {DOCUMENT_TYPES.map((t) => (
                    <NativeSelectOption key={t} value={t}>
                      {typeLabel(t)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            )}
          />
          <TextField form={form} name="version" label="Version" description="Unique per document." />
        </div>
        <TextField form={form} name="title" label="Title" />
        <Controller
          control={form.control}
          name="body"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="body">Text</FieldLabel>
              <Textarea {...field} id="body" rows={18} className="font-mono text-sm" aria-invalid={fieldState.invalid || undefined} />
              <FieldDescription>Shown to stores exactly as written. Use blank lines between paragraphs.</FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <TextField form={form} name="effective_at" label="Effective from (optional)" type="date" description="Leave empty to take effect when published." />
        <SwitchField form={form} name="required_at_registration" title="Required at sign-up" description="New stores must accept it to register." />
        <SwitchField form={form} name="requires_reacceptance" title="Existing stores must accept again" description="When published, active stores are asked to accept this version." />
      </FieldGroup>
      <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background/95 py-3 backdrop-blur">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Spinner data-icon="inline-start" /> : null}
          {doc ? "Save draft" : "Create draft"}
        </Button>
      </div>
    </form>
  )
}

type Form = ReturnType<typeof useForm<Values>>

function TextField({ form, name, label, description, type = "text" }: { form: Form; name: "version" | "title" | "effective_at"; label: string; description?: string; type?: "text" | "date" }) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Input {...field} id={name} type={type} className={type === "date" ? "w-48" : undefined} aria-invalid={fieldState.invalid || undefined} />
          {description ? <FieldDescription>{description}</FieldDescription> : null}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

function SwitchField({ form, name, title, description }: { form: Form; name: "required_at_registration" | "requires_reacceptance"; title: string; description: string }) {
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
