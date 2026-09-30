"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { safeNext } from "@workspace/bff/paths"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { Icon } from "@workspace/ui/icons"

const schema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
})

type Values = z.infer<typeof schema>

type Envelope = {
  success: boolean
  message?: string
  meta?: { error_code?: string }
  errors?: Record<string, string[]>
}

/** Tenant states the login can reveal (spec §9.2 step 5, §11.4). */
const TENANT_STATES: Record<string, { title: string; body: string }> = {
  tenant_suspended: {
    title: "This store is suspended",
    body: "Contact platform support to restore access.",
  },
  tenant_closed: {
    title: "This store is closed",
    body: "The store has been closed and can no longer be managed.",
  },
  tenant_provisioning: {
    title: "Your store is being set up",
    body: "This usually takes a minute. Try again shortly.",
  },
  subscription_payment_required: {
    title: "Payment required",
    body: "Sign in as the owner to complete the first payment.",
  },
  maintenance: {
    title: "Down for maintenance",
    body: "We'll be back shortly.",
  },
}

/**
 * Staff sign-in (spec §9.2). Posts to the BFF, which seals the token into
 * an HttpOnly cookie; the token never reaches this code.
 */
export function LoginForm({
  next,
  expired,
}: {
  next: string | undefined
  expired: boolean
}) {
  const router = useRouter()
  const [problem, setProblem] = useState<{
    title: string
    body: string
  } | null>(
    expired
      ? { title: "Your session ended", body: "Sign in again to continue." }
      : null
  )
  const [retryIn, setRetryIn] = useState(0)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  })

  useEffect(() => {
    if (retryIn <= 0) return
    const timer = setTimeout(() => setRetryIn((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [retryIn])

  async function onSubmit(values: Values) {
    setProblem(null)

    let response: Response
    try {
      response = await fetch("/bff/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "bff",
        },
        body: JSON.stringify(values),
      })
    } catch {
      setProblem({
        title: "You appear to be offline",
        body: "Check your connection and try again.",
      })
      return
    }

    if (response.ok) {
      router.replace(safeNext(next, "/"))
      router.refresh()
      return
    }

    const body = (await response.json().catch(() => null)) as Envelope | null
    const code = body?.meta?.error_code ?? ""

    if (response.status === 429) {
      const seconds = Number(response.headers.get("Retry-After") ?? "60")
      setRetryIn(Number.isFinite(seconds) ? seconds : 60)
      setProblem({
        title: "Too many attempts",
        body: "For your security, sign-in is paused for a moment.",
      })
      return
    }

    if (TENANT_STATES[code]) {
      setProblem(TENANT_STATES[code])
      return
    }

    if (body?.errors && Object.keys(body.errors).length > 0) {
      for (const [field, messages] of Object.entries(body.errors)) {
        if (field === "email" || field === "password")
          form.setError(field, { type: "server", message: messages.join(" ") })
      }
      if (!body.errors.email && !body.errors.password)
        setProblem({
          title: "Sign-in failed",
          body: body.message ?? "Check your details.",
        })
      return
    }

    setProblem({
      title:
        response.status === 401 || response.status === 403
          ? "Sign-in failed"
          : "Something went wrong",
      body: body?.message ?? "Try again in a moment.",
    })
  }

  const submitting = form.formState.isSubmitting

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-6"
    >
      {problem ? (
        <Alert
          variant={
            expired && problem.title === "Your session ended"
              ? "default"
              : "destructive"
          }
        >
          <Icon
            name={
              expired && problem.title === "Your session ended"
                ? "info"
                : "error"
            }
          />
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
              <Input
                {...field}
                id="email"
                type="email"
                autoComplete="username"
                autoFocus
                aria-invalid={fieldState.invalid || undefined}
              />
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
                <a
                  href="/forgot-password"
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Forgot password?
                </a>
              </div>
              <Input
                {...field}
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid || undefined}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>

      <Button
        type="submit"
        size="lg"
        disabled={submitting || retryIn > 0}
        className="w-full"
      >
        {submitting ? <Spinner data-icon="inline-start" /> : null}
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  )
}
