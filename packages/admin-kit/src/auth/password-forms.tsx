"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { ButtonLink } from "@workspace/ui/components/button-link"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { Icon } from "@workspace/ui/icons"

import { postAuth } from "./post"

const forgotSchema = z.object({ email: z.email("Enter a valid email address.") })

/**
 * Requests a reset link (spec §9.4). The backend answers the same whether or
 * not the account exists, so the confirmation never reveals that.
 */
export function ForgotPasswordForm({ loginHref = "/login" }: { loginHref?: string }) {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const form = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } })

  async function onSubmit(values: z.infer<typeof forgotSchema>) {
    setError(null)
    const result = await postAuth("/bff/auth/forgot", values)

    if (result.ok) {
      setSentTo(values.email)
      return
    }
    if (result.fieldErrors.email) {
      form.setError("email", { type: "server", message: result.fieldErrors.email.join(" ") })
      return
    }
    setError(result.status === 429 ? "Too many requests. Wait a minute and try again." : (result.message ?? "Something went wrong. Try again."))
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-6">
        <Alert>
          <Icon name="mail" />
          <AlertTitle>Check your email</AlertTitle>
          <AlertDescription>If an account exists for {sentTo}, a link to reset the password is on its way.</AlertDescription>
        </Alert>
        <ButtonLink variant="outline" render={<Link href={loginHref} />}>
          Back to sign in
        </ButtonLink>
      </div>
    )
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {error ? (
        <Alert variant="destructive">
          <Icon name="error" />
          <AlertTitle>That didn&apos;t work</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Controller
        control={form.control}
        name="email"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid || undefined}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input {...field} id="email" type="email" autoComplete="username" autoFocus aria-invalid={fieldState.invalid || undefined} />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Spinner data-icon="inline-start" /> : null}
        Send reset link
      </Button>
      <Link href={loginHref} className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        Back to sign in
      </Link>
    </form>
  )
}

const resetSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters."),
    password_confirmation: z.string(),
  })
  .refine((v) => v.password === v.password_confirmation, { path: ["password_confirmation"], message: "The passwords don't match." })

/**
 * Sets a new password from the emailed link (spec §9.4). The link's query
 * (`token`, `email`) is sent unchanged; the page does not interpret it.
 * Platform-user invitations use the same link.
 */
export function ResetPasswordForm({ token, email, loginHref = "/login" }: { token: string; email: string; loginHref?: string }) {
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const form = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema), defaultValues: { password: "", password_confirmation: "" } })

  if (!token || !email) {
    return (
      <Alert variant="destructive">
        <Icon name="error" />
        <AlertTitle>This link is incomplete</AlertTitle>
        <AlertDescription>Open the link from your email again, or request a new one.</AlertDescription>
      </Alert>
    )
  }

  async function onSubmit(values: z.infer<typeof resetSchema>) {
    setError(null)
    const result = await postAuth("/bff/auth/reset", { ...values, token, email })

    if (result.ok) {
      setDone(true)
      return
    }
    if (result.fieldErrors.password) {
      form.setError("password", { type: "server", message: result.fieldErrors.password.join(" ") })
      return
    }
    setError(result.fieldErrors.token?.join(" ") ?? result.fieldErrors.email?.join(" ") ?? result.message ?? "This link is invalid or has expired.")
  }

  if (done) {
    return (
      <div className="flex flex-col gap-6">
        <Alert>
          <Icon name="success" />
          <AlertTitle>Password saved</AlertTitle>
          <AlertDescription>You can now sign in with your new password.</AlertDescription>
        </Alert>
        <ButtonLink render={<Link href={`${loginHref}?email=${encodeURIComponent(email)}`} />}>
          Sign in
        </ButtonLink>
      </div>
    )
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {error ? (
        <Alert variant="destructive">
          <Icon name="error" />
          <AlertTitle>We couldn&apos;t reset your password</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="reset-email">Email</FieldLabel>
          <Input id="reset-email" value={email} readOnly disabled />
        </Field>
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="password">New password</FieldLabel>
              <Input {...field} id="password" type="password" autoComplete="new-password" autoFocus aria-invalid={fieldState.invalid || undefined} />
              <FieldDescription>At least 8 characters, with letters and numbers.</FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="password_confirmation"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="password_confirmation">Confirm password</FieldLabel>
              <Input {...field} id="password_confirmation" type="password" autoComplete="new-password" aria-invalid={fieldState.invalid || undefined} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>
      <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Spinner data-icon="inline-start" /> : null}
        Save password
      </Button>
    </form>
  )
}
