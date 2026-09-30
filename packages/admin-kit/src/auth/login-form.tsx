"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { safeNext } from "@workspace/bff/paths"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { Icon } from "@workspace/ui/icons"

import { postAuth } from "./post"

const schema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
})

type Values = z.infer<typeof schema>
export type Problem = { title: string; body: string; tone?: "info" | "error" }

/**
 * Sign-in for any admin actor (spec §9.2). Posts to the app's BFF, which
 * seals the token into an HttpOnly cookie; the token never reaches this code.
 * `states` maps backend error codes to full explanations (tenant states on
 * tenant-admin, for example).
 */
export function LoginForm({
  next,
  expired = false,
  initialEmail = "",
  home = "/",
  forgotHref = "/forgot-password",
  states = {},
}: {
  next?: string | undefined
  expired?: boolean
  initialEmail?: string
  home?: string
  forgotHref?: string | null
  states?: Record<string, Problem>
}) {
  const router = useRouter()
  const [problem, setProblem] = useState<Problem | null>(
    expired ? { title: "Your session ended", body: "Sign in again to continue.", tone: "info" } : null,
  )
  const [retryIn, setRetryIn] = useState(0)

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: initialEmail, password: "" } })

  useEffect(() => {
    if (retryIn <= 0) return
    const timer = setTimeout(() => setRetryIn((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [retryIn])

  async function onSubmit(values: Values) {
    setProblem(null)
    const result = await postAuth("/bff/auth/login", values)

    if (result.ok) {
      router.replace(safeNext(next, home))
      router.refresh()
      return
    }

    if (result.network) {
      setProblem({ title: "You appear to be offline", body: "Check your connection and try again." })
      return
    }

    if (result.status === 429) {
      setRetryIn(result.retryAfter ?? 60)
      setProblem({ title: "Too many attempts", body: "For your security, sign-in is paused for a moment." })
      return
    }

    const known = states[result.code]
    if (known) {
      setProblem(known)
      return
    }

    const { email, password } = result.fieldErrors
    if (email) form.setError("email", { type: "server", message: email.join(" ") })
    if (password) form.setError("password", { type: "server", message: password.join(" ") })
    if (email || password) return

    setProblem({
      title: result.status === 401 || result.status === 403 || result.status === 422 ? "Sign-in failed" : "Something went wrong",
      body: result.message ?? "Try again in a moment.",
    })
  }

  const submitting = form.formState.isSubmitting

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {problem ? (
        <Alert variant={problem.tone === "info" ? "default" : "destructive"}>
          <Icon name={problem.tone === "info" ? "info" : "error"} />
          <AlertTitle>{problem.title}</AlertTitle>
          <AlertDescription>
            {problem.body}
            {retryIn > 0 ? ` Try again in ${retryIn}s.` : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input {...field} id="email" type="email" autoComplete="username" autoFocus={!initialEmail} aria-invalid={fieldState.invalid || undefined} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                {forgotHref ? (
                  <a href={forgotHref} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                    Forgot password?
                  </a>
                ) : null}
              </div>
              <Input
                {...field}
                id="password"
                type="password"
                autoComplete="current-password"
                autoFocus={Boolean(initialEmail)}
                aria-invalid={fieldState.invalid || undefined}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>

      <Button type="submit" size="lg" disabled={submitting || retryIn > 0} className="w-full">
        {submitting ? <Spinner data-icon="inline-start" /> : null}
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  )
}
