"use client"

import { useState } from "react"

import { isApiError } from "@workspace/api-client"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"

import { useSetBillingMode, type Mode } from "./api"

const ERRORS: Record<string, string> = {
  no_live_gateway: "Enable at least one tested live gateway before switching to live.",
  live_payments_disabled: "Live payments are disabled in this environment.",
}

/**
 * Switches the platform's billing between test and live (spec §15.9
 * safeguard 5): an explicit confirmation and a reason, recorded in the
 * activity log. It affects new subscriptions only.
 */
export function ModeDialog({ open, onOpenChange, target }: { open: boolean; onOpenChange: (open: boolean) => void; target: Mode }) {
  const setMode = useSetBillingMode()
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  function close(next: boolean) {
    if (!next) {
      setReason("")
      setError(null)
    }
    onOpenChange(next)
  }

  async function confirm() {
    if (!reason.trim()) {
      setError("Give a reason. It is kept in the activity log.")
      return
    }
    try {
      await setMode.mutateAsync({ mode: target, reason: reason.trim() })
      toast.add({ title: target === "live" ? "Billing is now live" : "Billing is now in test mode", type: "success" })
      close(false)
    } catch (e) {
      setError(isApiError(e) ? (ERRORS[e.code] ?? e.fieldErrors.reason?.join(" ") ?? e.message) : "Try again in a moment.")
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={close}
      title={target === "live" ? "Switch billing to live?" : "Switch billing to test?"}
      description={
        target === "live"
          ? "New subscriptions and sign-ups will be charged real money through the live gateways. Existing subscriptions are not affected."
          : "New subscriptions and sign-ups will use test gateways, and no real money will move. Existing subscriptions are not affected."
      }
      confirmLabel={target === "live" ? "Go live" : "Switch to test"}
      destructive={target === "live"}
      pending={setMode.isPending}
      onConfirm={confirm}
    >
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="mode-reason">Reason</FieldLabel>
        <Textarea
          id="mode-reason"
          value={reason}
          maxLength={500}
          rows={3}
          onChange={(e) => {
            setReason(e.target.value)
            setError(null)
          }}
          aria-invalid={error ? true : undefined}
        />
        {error ? <FieldError>{error}</FieldError> : <FieldDescription>Recorded in the activity log with your name.</FieldDescription>}
      </Field>
    </ConfirmDialog>
  )
}
