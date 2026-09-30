"use client"

import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form"

import { isApiError } from "@workspace/api-client"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Icon } from "@workspace/ui/icons"

import { presentError } from "../states"

/**
 * Maps a failed save onto the form (spec §18.4): each Laravel field error
 * (dot notation is also RHF's path notation) becomes a field error; errors
 * for fields the form does not render are returned so they can be shown in
 * a form-level alert. Focuses the first invalid field.
 */
export function applyApiErrors<T extends FieldValues, C, O extends FieldValues>(
  form: UseFormReturn<T, C, O>,
  error: unknown
): string[] {
  if (!isApiError(error)) return [presentError(error).description]

  const registered = new Set(Object.keys(form.control._fields))
  const unmatched: string[] = []
  let first: FieldPath<T> | null = null

  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const message = messages.join(" ")
    const root = field.split(".")[0] ?? field

    if (registered.has(field) || registered.has(root)) {
      form.setError(field as FieldPath<T>, { type: "server", message })
      first ??= field as FieldPath<T>
    } else {
      unmatched.push(message)
    }
  }

  if (first !== null) form.setFocus(first)

  if (Object.keys(error.fieldErrors).length === 0)
    unmatched.push(presentError(error).description)

  return unmatched
}

/** Form-level errors: server messages with no field, and non-validation failures. */
export function FormErrors({
  messages,
  title = "We couldn't save your changes",
}: {
  messages: string[]
  title?: string
}) {
  if (messages.length === 0) return null

  return (
    <Alert variant="destructive" role="alert">
      <Icon name="error" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {messages.length === 1 ? (
          messages[0]
        ) : (
          <ul className="list-disc ps-4">
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  )
}
