"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { useMemo, useRef, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { useCan } from "@workspace/access/react"
import { FormErrors, applyApiErrors } from "@workspace/admin-kit/forms"
import { StateView } from "@workspace/admin-kit/states"
import { DataTable, FilterSelect, type DataColumn } from "@workspace/admin-kit/table"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"
import { Icon } from "@workspace/ui/icons"

import {
  AUDIENCES,
  AUDIENCE_LABELS,
  previewText,
  templateGroup,
  templateName,
  templatesQuery,
  unknownPlaceholders,
  useResetTemplate,
  useUpdateTemplate,
  type Template,
} from "./api"

const params = {
  q: parseAsString.withDefault(""),
  audience: parseAsStringLiteral(AUDIENCES),
  state: parseAsStringLiteral(["on", "off", "edited"] as const),
}

/** Every platform message: its wording, who gets it and whether it is sent (spec §17.7). */
export function TemplatesTab() {
  const query = useQuery(templatesQuery)
  const [filters, setFilters] = useQueryStates(params, { clearOnDefault: true, history: "replace" })
  const [editing, setEditing] = useState<string | null>(null)
  const canUpdate = useCan("landlord.notifications.templates.update")

  // The list is small and unpaginated, so filtering happens here and is instant.
  const rows = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    return query.data?.filter(
      (t) =>
        (!q || t.key.toLowerCase().includes(q) || templateName(t.key).toLowerCase().includes(q) || (t.subject ?? "").toLowerCase().includes(q)) &&
        (!filters.audience || t.target_audience.includes(filters.audience)) &&
        (!filters.state || (filters.state === "on" ? t.is_active : filters.state === "off" ? !t.is_active : t.is_customized))
    )
  }, [query.data, filters])

  const columns = useMemo<DataColumn<Template>[]>(
    () => [
      {
        id: "message",
        header: "Message",
        mobile: "title",
        cell: (t) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{templateName(t.key)}</span>
            <span className="truncate text-xs text-muted-foreground">{t.subject ?? "No subject"}</span>
          </span>
        ),
      },
      { id: "area", header: "Area", mobile: "subtitle", cell: (t) => templateGroup(t.key) },
      {
        id: "status",
        header: "Status",
        mobile: "meta",
        cell: (t) => (t.is_active ? <StatusBadge tone="success">On</StatusBadge> : <StatusBadge tone="muted">Off</StatusBadge>),
      },
      {
        id: "audience",
        header: "Sent to",
        mobile: "detail",
        cell: (t) => t.target_audience.map((a) => AUDIENCE_LABELS[a] ?? a).join(", "),
      },
      {
        id: "flags",
        header: "Notes",
        mobile: "detail",
        cell: (t) =>
          t.is_mandatory || t.is_customized ? (
            <span className="flex flex-wrap gap-1">
              {t.is_mandatory ? <Badge variant="outline">Required</Badge> : null}
              {t.is_customized ? <Badge variant="secondary">Edited</Badge> : null}
            </span>
          ) : (
            "—"
          ),
      },
      { id: "key", header: "Key", hideable: true, defaultHidden: true, mobile: "hidden", cell: (t) => <span className="font-mono text-xs">{t.key}</span> },
    ],
    []
  )

  const current = query.data?.find((t) => t.key === editing) ?? null

  return (
    <>
      <DataTable<Template>
        tableId="notification-templates"
        columns={columns}
        rows={rows}
        getRowId={(t) => t.key}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        filtered={Boolean(filters.q || filters.audience || filters.state)}
        rowActions={(t) =>
          canUpdate ? (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setEditing(t.key)}>
                Edit
              </Button>
            </div>
          ) : null
        }
        toolbar={
          <>
            <InputGroup className="w-full sm:w-64">
              <InputGroupAddon>
                <Icon name="search" />
              </InputGroupAddon>
              <InputGroupInput value={filters.q} onChange={(e) => void setFilters({ q: e.target.value })} placeholder="Name or subject" aria-label="Search messages" />
            </InputGroup>
            <FilterSelect
              label="Sent to"
              anyLabel="Anyone"
              value={filters.audience}
              options={AUDIENCES.map((a) => ({ value: a, label: AUDIENCE_LABELS[a] ?? a }))}
              onChange={(audience) => void setFilters({ audience })}
            />
            <FilterSelect
              label="Status"
              anyLabel="Any status"
              value={filters.state}
              options={[
                { value: "on", label: "On" },
                { value: "off", label: "Off" },
                { value: "edited", label: "Edited" },
              ]}
              onChange={(state) => void setFilters({ state })}
            />
          </>
        }
        emptyState={<StateView icon="notifications" title="No messages" description="Run the notification template seeder to load the platform messages." />}
        noResultsState={<StateView icon="search" title="No messages match" description="Try another name, audience or status." />}
      />
      <TemplateSheet template={current} onClose={() => setEditing(null)} />
    </>
  )
}

function TemplateSheet({ template, onClose }: { template: Template | null; onClose: () => void }) {
  const isMobile = useIsMobile()
  return (
    <Sheet open={template !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <SheetContent side={isMobile ? "bottom" : "right"} className="max-h-[92svh] gap-0 data-[side=right]:max-h-none sm:max-w-xl">
        {template ? <TemplateForm key={template.key} template={template} onDone={onClose} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function schemaFor(variables: readonly string[]) {
  const known = (text: string, ctx: z.RefinementCtx) => {
    const unknown = unknownPlaceholders(text, variables)
    if (unknown.length > 0) ctx.addIssue({ code: "custom", message: `Unknown placeholder ${unknown.map((v) => `{{${v}}}`).join(", ")}. Use one of the placeholders below.` })
  }
  return z.object({
    subject: z.string().trim().max(255).superRefine(known),
    body: z.string().trim().min(1, "Enter the message text.").max(10000).superRefine(known),
    is_active: z.boolean(),
  })
}
type Values = z.infer<ReturnType<typeof schemaFor>>
type Target = "subject" | "body"

function TemplateForm({ template, onDone }: { template: Template; onDone: () => void }) {
  const update = useUpdateTemplate(template.key)
  const reset = useResetTemplate(template.key)
  const canReset = useCan("landlord.notifications.templates.reset")
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [confirmReset, setConfirmReset] = useState(false)
  const lastFocused = useRef<Target>("body")
  const schema = useMemo(() => schemaFor(template.variables), [template.variables])
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { subject: template.subject ?? "", body: template.body, is_active: template.is_active },
  })
  const [subject, body] = useWatch({ control: form.control, name: ["subject", "body"] })

  /** Puts {{name}} at the caret of the field last used, or at the end of the body. */
  function insert(variable: string) {
    const target = lastFocused.current
    const el = document.getElementById(`template-${target}`)
    const value = form.getValues(target)
    const token = `{{${variable}}}`
    const isField = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
    const start = isField ? (el.selectionStart ?? value.length) : value.length
    const end = isField ? (el.selectionEnd ?? value.length) : value.length
    form.setValue(target, value.slice(0, start) + token + value.slice(end), { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
    if (isField) {
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(start + token.length, start + token.length)
      })
    }
  }

  async function onSubmit(values: Values) {
    setFormErrors([])
    const dirty = form.formState.dirtyFields
    // Only what changed is sent: saving the wording marks the message as edited.
    const payload = {
      ...(dirty.subject ? { subject: values.subject || null } : {}),
      ...(dirty.body ? { body: values.body } : {}),
      ...(dirty.is_active ? { is_active: values.is_active } : {}),
    }
    if (Object.keys(payload).length === 0) {
      onDone()
      return
    }
    try {
      await update.mutateAsync(payload)
      toast.add({ title: `${templateName(template.key)} saved`, type: "success" })
      onDone()
    } catch (error) {
      setFormErrors(applyApiErrors(form, error))
    }
  }

  async function runReset() {
    try {
      const restored = await reset.mutateAsync()
      form.reset({ subject: restored.subject ?? "", body: restored.body, is_active: restored.is_active })
      toast.add({ title: "Default wording restored", type: "success" })
      setConfirmReset(false)
    } catch {
      toast.add({ title: "Couldn't restore the default", type: "error" })
    }
  }

  const pending = update.isPending || reset.isPending

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
      <SheetHeader>
        <SheetTitle>{templateName(template.key)}</SheetTitle>
        <SheetDescription>
          {templateGroup(template.key)} · sent to {template.target_audience.map((a) => (AUDIENCE_LABELS[a] ?? a).toLowerCase()).join(", ")}
        </SheetDescription>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
        <FormErrors messages={formErrors} />
        <FieldGroup>
          <Controller
            control={form.control}
            name="subject"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor="template-subject">Subject</FieldLabel>
                <Input {...field} id="template-subject" onFocus={() => (lastFocused.current = "subject")} aria-invalid={fieldState.invalid || undefined} />
                <FieldDescription>Used for email and in-app messages.</FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="body"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor="template-body">Message</FieldLabel>
                <Textarea {...field} id="template-body" rows={10} onFocus={() => (lastFocused.current = "body")} aria-invalid={fieldState.invalid || undefined} />
                <FieldDescription>Plain text. Leave a blank line between paragraphs.</FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          {template.variables.length > 0 ? (
            <Field>
              <FieldTitle>Placeholders</FieldTitle>
              <div className="flex flex-wrap gap-1.5">
                {template.variables.map((v) => (
                  <Button key={v} type="button" variant="outline" size="xs" className="font-mono" onClick={() => insert(v)}>
                    {`{{${v}}}`}
                  </Button>
                ))}
              </div>
              <FieldDescription>Select one to add it where the cursor is. Each is replaced with the real value when the message is sent.</FieldDescription>
            </Field>
          ) : null}
          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>Send this message</FieldTitle>
                  <FieldDescription>{template.is_mandatory ? "Required by the platform, so it can't be turned off." : "When off, it isn't sent on any channel."}</FieldDescription>
                </FieldContent>
                <Switch checked={field.value} onCheckedChange={field.onChange} disabled={template.is_mandatory} aria-label="Send this message" />
              </Field>
            )}
          />
        </FieldGroup>

        <section aria-label="Preview" className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Preview</p>
          {subject.trim() ? <p className="font-medium">{previewText(subject)}</p> : null}
          <p className="text-sm whitespace-pre-wrap">{previewText(body)}</p>
          <p className="text-xs text-muted-foreground">Placeholders show as [name]; recipients see real values.</p>
        </section>
      </div>

      <SheetFooter className="flex-col-reverse gap-2 border-t sm:flex-row sm:items-center">
        {template.is_customized && canReset ? (
          <Button type="button" variant="ghost" className="sm:mr-auto" onClick={() => setConfirmReset(true)} disabled={pending}>
            Restore default
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {update.isPending ? <Spinner data-icon="inline-start" /> : null}
          Save
        </Button>
      </SheetFooter>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Restore the default wording?"
        description="The subject and message go back to the platform's original text. Your edits are lost."
        confirmLabel="Restore default"
        pending={reset.isPending}
        onConfirm={() => void runReset()}
      />
    </form>
  )
}
