"use client"

import { useQuery } from "@tanstack/react-query"
import { parseAsString, useQueryState } from "nuqs"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"

import { useCan } from "@workspace/access/react"
import { FormErrors } from "@workspace/admin-kit/forms"
import { ErrorState } from "@workspace/admin-kit/states"
import { isApiError } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@workspace/ui/components/field"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"
import { cn } from "@workspace/ui/lib/utils"

import { groupQuery, useUpdateGroup, type SettingEntry, type SettingsGroup } from "./api"
import { SettingField, type SettingsFormValues } from "./fields"
import { ImageSettings } from "./image-settings"
import { GROUPS, IMAGE_SLOTS, fieldLabel } from "./meta"

const GROUP_IDS = Object.keys(GROUPS)

/** Editable keys: not uploaded images, not own-route or encrypted keys. */
const editable = (group: SettingsGroup) =>
  Object.entries(group).filter(([key, entry]) => !IMAGE_SLOTS[key] && !entry.own_route && entry.type !== "encrypted_json")

/** What the form edits: numbers as strings, everything else as-is. */
function toFormValue(entry: SettingEntry): unknown {
  if (entry.type === "int" || entry.type === "decimal") return entry.value == null ? "" : String(entry.value)
  return entry.value
}

/** What the API receives: numbers parsed, empty optional values as null. */
function toApiValue(entry: SettingEntry, value: unknown): unknown {
  if (entry.type === "int" || entry.type === "decimal") {
    if (value === "" || value == null) return entry.nullable ? null : value
    const n = Number(value)
    return Number.isFinite(n) ? n : value
  }
  if (entry.type === "string" && value === "" && entry.nullable) return null
  return value
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

function GroupForm({ group, data, canEdit, onDirtyChange }: { group: string; data: SettingsGroup; canEdit: boolean; onDirtyChange: (dirty: boolean) => void }) {
  const fields = useMemo(() => editable(data), [data])
  const defaults = useMemo(() => Object.fromEntries(fields.map(([key, entry]) => [key, toFormValue(entry)])), [fields])
  const form = useForm<SettingsFormValues>({ defaultValues: defaults })
  const update = useUpdateGroup(group)
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [reasonOpen, setReasonOpen] = useState(false)
  const [reason, setReason] = useState("")
  const dirty = form.formState.isDirty

  useEffect(() => form.reset(defaults), [defaults, form])
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])

  // Unsaved-change protection for reloads and tab closes.
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  const changes = (values: SettingsFormValues) =>
    Object.fromEntries(fields.filter(([key]) => !same(values[key], defaults[key])).map(([key, entry]) => [key, toApiValue(entry, values[key])]))

  async function save(withReason?: string) {
    const values = changes(form.getValues())
    if (Object.keys(values).length === 0) return

    setFormErrors([])
    try {
      await update.mutateAsync({ values, ...(withReason ? { reason: withReason } : {}) })
      toast.add({ title: `${GROUPS[group]?.label ?? "Settings"} saved`, type: "success" })
      setReasonOpen(false)
      setReason("")
    } catch (error) {
      if (!isApiError(error)) {
        setFormErrors(["Something went wrong. Try again."])
        return
      }
      const unmatched: string[] = []
      for (const [path, messages] of Object.entries(error.fieldErrors)) {
        const key = path.replace(/^values\./, "").split(".")[0] ?? path
        if (key in defaults) form.setError(key, { type: "server", message: messages.join(" ") })
        else if (path === "reason") setReasonOpen(true)
        else unmatched.push(messages.join(" "))
      }
      if (Object.keys(error.fieldErrors).length === 0) unmatched.push(error.message)
      setFormErrors(unmatched)
      if (!error.fieldErrors.reason) setReasonOpen(false)
    }
  }

  function onSubmit(values: SettingsFormValues) {
    const changed = Object.keys(changes(values))
    const needsReason = changed.some((key) => data[key]?.reason_required)
    if (needsReason) setReasonOpen(true)
    else void save()
  }

  const needReasonKeys = Object.keys(changes(form.watch())).filter((key) => data[key]?.reason_required)

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <FormErrors messages={formErrors} />
      <fieldset disabled={!canEdit || update.isPending} className="contents">
        <FieldGroup>
          {fields.map(([key, entry], index) => (
            <div key={key} className="flex flex-col gap-6">
              {index > 0 ? <FieldSeparator /> : null}
              <SettingField settingKey={key} entry={entry} control={form.control} />
            </div>
          ))}
          {Object.entries(data)
            .filter(([, entry]) => entry.own_route)
            .map(([key, entry]) => (
              <div key={key} className="flex flex-col gap-6">
                <FieldSeparator />
                <SettingField settingKey={key} entry={entry} control={form.control} />
              </div>
            ))}
        </FieldGroup>
      </fieldset>

      {canEdit ? (
        <div
          className={cn(
            "sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6",
            !dirty && "hidden"
          )}
        >
          <p className="text-sm text-muted-foreground">You have unsaved changes.</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => form.reset(defaults)} disabled={update.isPending} className="flex-1 sm:flex-none">
              Discard
            </Button>
            <Button type="submit" disabled={update.isPending} className="flex-1 sm:flex-none">
              {update.isPending ? <Spinner data-icon="inline-start" /> : null}
              Save changes
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={reasonOpen}
        onOpenChange={setReasonOpen}
        title="Why are you making this change?"
        description={`These settings affect every store and are audited: ${needReasonKeys.map(fieldLabel).join(", ")}.`}
        confirmLabel="Save with reason"
        pending={update.isPending}
        onConfirm={() => {
          if (reason.trim().length > 0) void save(reason.trim())
        }}
      >
        <Field>
          <FieldLabel htmlFor="change-reason">Reason</FieldLabel>
          <Textarea id="change-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          <FieldDescription>Recorded with the change in the platform audit log.</FieldDescription>
        </Field>
      </ConfirmDialog>
    </form>
  )
}

/** Platform settings (spec §25.1): grouped forms, one save per group. */
export function SettingsPage() {
  const [groupParam, setGroup] = useQueryState("group", parseAsString.withDefault("general"))
  const group = GROUP_IDS.includes(groupParam) ? groupParam : "general"
  const canEdit = useCan("landlord.settings.update")
  const query = useQuery(groupQuery(group))
  const [dirty, setDirty] = useState(false)
  const [pendingGroup, setPendingGroup] = useState<string | null>(null)
  const meta = GROUPS[group]

  const choose = (next: string) => {
    if (next === group) return
    if (dirty) setPendingGroup(next)
    else void setGroup(next)
  }

  return (
    <>
      <PageHeader title="Settings" description="Platform-wide configuration. Each section saves on its own." />

      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-20 flex flex-col gap-0.5">
            {GROUP_IDS.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => choose(id)}
                  aria-current={id === group ? "page" : undefined}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-start text-sm transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                    id === group ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {GROUPS[id]?.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          <Select value={group} onValueChange={(v) => v && choose(String(v))} items={GROUP_IDS.map((id) => ({ value: id, label: GROUPS[id]?.label ?? id }))}>
            <SelectTrigger aria-label="Settings section" className="w-full lg:hidden">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {GROUP_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {GROUPS[id]?.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Card>
            <CardHeader>
              <CardTitle>{meta?.label}</CardTitle>
              <CardDescription>{meta?.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {query.isPending ? (
                <div className="flex flex-col gap-6">
                  {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ))}
                </div>
              ) : query.isError ? (
                <ErrorState error={query.error} onRetry={() => void query.refetch()} />
              ) : (
                <>
                  {group === "general" ? <ImageSettings keys={Object.keys(query.data)} /> : null}
                  <GroupForm key={group} group={group} data={query.data} canEdit={canEdit} onDirtyChange={setDirty} />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={pendingGroup !== null}
        onOpenChange={(open) => !open && setPendingGroup(null)}
        title="Discard unsaved changes?"
        description="You have changes in this section that aren't saved yet."
        confirmLabel="Discard changes"
        destructive
        onConfirm={() => {
          if (pendingGroup) void setGroup(pendingGroup)
          setPendingGroup(null)
          setDirty(false)
        }}
      />
    </>
  )
}
