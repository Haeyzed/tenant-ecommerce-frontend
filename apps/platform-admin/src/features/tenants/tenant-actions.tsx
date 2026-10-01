"use client"

import { useState } from "react"

import { useCan } from "@workspace/access/react"
import { isApiError } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu"
import { Field, FieldDescription, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"
import { Icon } from "@workspace/ui/icons"

import { allowedActions, useTenantAction, type LifecycleAction, type Tenant } from "./api"

type Copy = {
  menu: string
  title: string
  description: string
  confirm: string
  destructive: boolean
  reason: "none" | "optional" | "required"
  done: string
}

const COPY: Record<LifecycleAction, (name: string) => Copy> = {
  suspend: (name) => ({
    menu: "Suspend",
    title: `Suspend ${name}?`,
    description: "The store and its admin are blocked until you reactivate it. Nothing is deleted.",
    confirm: "Suspend",
    destructive: true,
    reason: "optional",
    done: `${name} suspended`,
  }),
  reactivate: (name) => ({
    menu: "Reactivate",
    title: `Reactivate ${name}?`,
    description: "The store and its admin open again straight away.",
    confirm: "Reactivate",
    destructive: false,
    reason: "none",
    done: `${name} reactivated`,
  }),
  close: (name) => ({
    menu: "Close store",
    title: `Close ${name}?`,
    description: "Everyone is signed out and the store goes offline. Its data is kept for the retention period, then purged. You can restore it until then.",
    confirm: "Close store",
    destructive: true,
    reason: "required",
    done: `${name} closed`,
  }),
  restore: (name) => ({
    menu: "Restore",
    title: `Restore ${name}?`,
    description: "The store becomes active again with all its data, and the purge is cancelled.",
    confirm: "Restore",
    destructive: false,
    reason: "none",
    done: `${name} restored`,
  }),
  export: (name) => ({
    menu: "Export data",
    title: `Export ${name}'s data?`,
    description: "A full export is prepared in the background and a download link is emailed to you.",
    confirm: "Start export",
    destructive: false,
    reason: "none",
    done: "Export started. The link will be emailed to you.",
  }),
}

const ERRORS: Record<string, string> = {
  invalid_transition: "The store's status changed. Refresh to see what you can do now.",
  tenant_never_provisioned: "This store was never set up, so there is nothing to restore.",
  tenant_not_exportable: "Only a set-up store that is active, suspended or closed can be exported.",
}

/** The lifecycle actions the tenant's status allows, each confirmed (spec §25.1). */
export function TenantActions({ tenant }: { tenant: Tenant }) {
  const action = useTenantAction(tenant.id)
  const [current, setCurrent] = useState<LifecycleAction | null>(null)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const can: Record<LifecycleAction, boolean> = {
    suspend: useCan("landlord.tenancy.tenants.suspend"),
    reactivate: useCan("landlord.tenancy.tenants.reactivate"),
    close: useCan("landlord.tenancy.tenants.close"),
    restore: useCan("landlord.tenancy.tenants.restore"),
    export: useCan("landlord.tenancy.tenants.export"),
  }

  const available = allowedActions(tenant).filter((a) => can[a])
  if (available.length === 0) return null

  const copy = current ? COPY[current](tenant.name) : null
  // The first non-destructive action is offered as a button; the rest go in the menu.
  const primary = available.find((a) => a === "reactivate" || a === "restore") ?? null
  const rest = available.filter((a) => a !== primary)

  function open(a: LifecycleAction) {
    setReason("")
    setError(null)
    setCurrent(a)
  }

  async function confirm() {
    if (!current || !copy) return
    if (copy.reason === "required" && !reason.trim()) {
      setError("Give a reason. It is kept with the store's history.")
      return
    }
    try {
      await action.mutateAsync({ action: current, reason: reason.trim() || undefined })
      toast.add({ title: copy.done, type: "success" })
      setCurrent(null)
    } catch (e) {
      setError(isApiError(e) ? (ERRORS[e.code] ?? e.message) : "That didn't work. Try again.")
    }
  }

  return (
    <>
      {primary ? <Button onClick={() => open(primary)}>{COPY[primary](tenant.name).menu}</Button> : null}
      {rest.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" aria-label="More actions" />}>
            Actions
            <Icon name="arrowDown" data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {rest.map((a) => (
              <DropdownMenuItem key={a} variant={a === "close" || a === "suspend" ? "destructive" : "default"} onClick={() => open(a)}>
                {COPY[a](tenant.name).menu}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <ConfirmDialog
        open={current !== null}
        onOpenChange={(o) => (o ? null : setCurrent(null))}
        title={copy?.title ?? ""}
        description={copy?.description ?? ""}
        confirmLabel={copy?.confirm ?? ""}
        destructive={copy?.destructive ?? false}
        pending={action.isPending}
        onConfirm={() => void confirm()}
      >
        {copy && copy.reason !== "none" ? (
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="lifecycle-reason">Reason{copy.reason === "optional" ? " (optional)" : ""}</FieldLabel>
            <Textarea
              id="lifecycle-reason"
              rows={3}
              maxLength={255}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                setError(null)
              }}
              aria-invalid={error ? true : undefined}
            />
            {error ? <FieldError>{error}</FieldError> : <FieldDescription>Shown on the store's record.</FieldDescription>}
          </Field>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
      </ConfirmDialog>
    </>
  )
}
