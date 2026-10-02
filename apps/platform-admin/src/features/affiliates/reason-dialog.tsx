"use client"

import { useState, type ReactNode } from "react"

import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"

export type ReasonPrompt = {
  title: string
  description: ReactNode
  confirmLabel: string
  destructive?: boolean
  /** The text field: none, optional or required. */
  text: "none" | "optional" | "required"
  /** Its label, e.g. "Reason", "Note" or "Transfer reference". */
  textLabel?: string
  textHint?: string
  /** A one-line input instead of a textarea. */
  singleLine?: boolean
  maxLength?: number
  requiredMessage?: string
}

/**
 * A confirmation that may ask for a reason, note or reference (spec §18.2).
 * `onConfirm` resolves to an error message to show, or null when done; the
 * dialog stays open on an error so the action can be retried. Remounted per
 * prompt, so the text starts empty each time.
 */
export function ReasonDialog({
  prompt,
  pending,
  onConfirm,
  onClose,
  children,
}: {
  prompt: ReasonPrompt | null
  pending: boolean
  onConfirm: (text: string) => Promise<string | null>
  onClose: () => void
  children?: ReactNode
}) {
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    if (!prompt) return
    const value = text.trim()
    if (prompt.text === "required" && !value) {
      setError(prompt.requiredMessage ?? `Enter a ${(prompt.textLabel ?? "reason").toLowerCase()}.`)
      return
    }
    setError(await onConfirm(value))
  }

  const label = prompt?.textLabel ?? "Reason"
  const inputProps = {
    id: "reason-dialog-text",
    maxLength: prompt?.maxLength ?? 255,
    value: text,
    onChange: (e: { target: { value: string } }) => {
      setText(e.target.value)
      setError(null)
    },
    "aria-invalid": error ? true : undefined,
  }

  return (
    <ConfirmDialog
      open={prompt !== null}
      onOpenChange={(open) => (open ? null : onClose())}
      title={prompt?.title ?? ""}
      description={prompt?.description ?? ""}
      confirmLabel={prompt?.confirmLabel ?? ""}
      destructive={prompt?.destructive ?? false}
      pending={pending}
      onConfirm={() => void confirm()}
    >
      {children}
      {prompt && prompt.text !== "none" ? (
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="reason-dialog-text">
            {label}
            {prompt.text === "optional" ? " (optional)" : ""}
          </FieldLabel>
          {prompt.singleLine ? <Input {...inputProps} autoComplete="off" /> : <Textarea {...inputProps} rows={3} />}
          {error ? <FieldError>{error}</FieldError> : prompt.textHint ? <FieldDescription>{prompt.textHint}</FieldDescription> : null}
        </Field>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
    </ConfirmDialog>
  )
}
