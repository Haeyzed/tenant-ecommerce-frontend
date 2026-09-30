"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

import { useCan } from "@workspace/access/react"
import { ErrorState } from "@workspace/admin-kit/states"
import { isApiError } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { toast } from "@workspace/ui/components/toast"

import { planLimitsQuery, useSetLimit, type Plan, type PlanLimit } from "./api"

type Draft = { text: string; unlimited: boolean }

const KIND_HINT: Record<string, string> = { count: "Maximum count", storage: "Megabytes", rate: "Requests per minute" }

function toDraft(limit: PlanLimit): Draft {
  return { text: limit.value === null ? "" : String(limit.value), unlimited: limit.value === null && limit.unlimitedAllowed }
}

function draftValue(draft: Draft): number | null | "invalid" {
  if (draft.unlimited) return null
  return /^\d+$/.test(draft.text.trim()) ? Number(draft.text.trim()) : "invalid"
}

/**
 * Usage limits (spec §11.8): every registered limit with this plan's value.
 * Lowering a limit never deletes data; stores over it just can't add more.
 */
export function LimitsTab({ plan }: { plan: Plan }) {
  const limits = useQuery(planLimitsQuery(plan.id))
  const setLimit = useSetLimit(plan.id)
  const canSave = useCan("landlord.plans.limits.store")
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  if (limits.isPending) return <Skeleton className="h-96 w-full" />
  if (limits.isError) return <ErrorState error={limits.error} onRetry={() => void limits.refetch()} />

  const rows = limits.data
  const draftFor = (limit: PlanLimit) => drafts[limit.key] ?? toDraft(limit)
  const changed = rows.filter((l) => {
    const value = draftValue(draftFor(l))
    return value === "invalid" || value !== l.value || !l.configured
  })

  function edit(key: string, next: Draft) {
    setDrafts((d) => ({ ...d, [key]: next }))
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([k]) => k !== key)))
  }

  async function save() {
    const nextErrors: Record<string, string> = {}
    for (const limit of changed) if (draftValue(draftFor(limit)) === "invalid") nextErrors[limit.key] = "Enter a whole number."
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    let saved = 0
    // One request per limit (the API upserts by key); stop at the first failure.
    for (const limit of changed) {
      const value = draftValue(draftFor(limit))
      if (value === "invalid") continue
      try {
        await setLimit.mutateAsync({ key: limit.key, value })
        saved += 1
      } catch (error) {
        const message = isApiError(error) ? (error.fieldErrors.limit_value?.join(" ") ?? error.message) : "Couldn't save."
        setErrors((e) => ({ ...e, [limit.key]: message }))
        break
      }
    }
    setSaving(false)
    setDrafts({})
    if (saved > 0) toast.add({ title: `${saved} ${saved === 1 ? "limit" : "limits"} saved`, type: "success" })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Stores over a lowered limit keep their data but can&apos;t add more until they upgrade. Store-specific overrides are set on the tenant.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Limit</TableHead>
              <TableHead>Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((limit) => {
              const draft = draftFor(limit)
              const error = errors[limit.key]
              return (
                <TableRow key={limit.key}>
                  <TableCell className="align-top">
                    <span className="flex flex-col">
                      <span className="font-medium">{limit.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {KIND_HINT[limit.kind] ?? limit.kind}
                        {limit.configured ? "" : " · not set"}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-3">
                      <Input
                        aria-label={limit.label}
                        value={draft.unlimited ? "" : draft.text}
                        placeholder={draft.unlimited ? "Unlimited" : undefined}
                        disabled={draft.unlimited || !canSave}
                        inputMode="numeric"
                        className="w-32"
                        aria-invalid={error ? true : undefined}
                        onChange={(e) => edit(limit.key, { ...draft, text: e.target.value })}
                      />
                      {limit.unlimitedAllowed ? (
                        <Label className="flex items-center gap-2 font-normal">
                          <Checkbox checked={draft.unlimited} disabled={!canSave} onCheckedChange={(checked) => edit(limit.key, { ...draft, unlimited: checked === true })} />
                          Unlimited
                        </Label>
                      ) : null}
                    </div>
                    {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {canSave ? (
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background/95 py-3 backdrop-blur">
          <span className="me-auto text-sm text-muted-foreground">{changed.length === 0 ? "No changes" : `${changed.length} unsaved`}</span>
          <Button variant="outline" disabled={saving || changed.length === 0} 
            onClick={() => {
              setDrafts({})
              setErrors({})
            }}
          >
            Discard
          </Button>
          <Button disabled={saving || changed.length === 0} onClick={() => void save()}>
            {saving ? <Spinner data-icon="inline-start" /> : null}
            Save limits
          </Button>
        </div>
      ) : null}
    </div>
  )
}
