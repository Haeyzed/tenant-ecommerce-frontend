"use client"

import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { isApiError, unwrap } from "@workspace/api-client"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@workspace/ui/components/input-otp"
import { Spinner } from "@workspace/ui/components/spinner"
import { Icon } from "@workspace/ui/icons"

import { useSignupEmail } from "./signup-store"
import { api } from "@/shell/api-client"

const RESEND_SECONDS = 60

type Problem = { tone: "error" | "info"; title: string; body: string }

/**
 * Step 3 of sign-up (spec §24.3): a six-digit code, verified automatically
 * when the email link carries it. Resend is limited to once a minute, as
 * the backend enforces.
 */
export function VerifyForm({ registration, initialCode }: { registration: string; initialCode: string | null }) {
  const router = useRouter()
  const [code, setCode] = useState(initialCode ?? "")
  const [codeError, setCodeError] = useState<string | null>(null)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const email = useSignupEmail(registration)
  const autoSubmitted = useRef(false)

  const statusPath = `/signup/status?registration=${encodeURIComponent(registration)}`
  const paymentPath = `/signup/payment?registration=${encodeURIComponent(registration)}`

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const verify = useMutation({
    mutationFn: async (value: string) =>
      unwrap(api.POST("/register/verify", { body: { registration_id: registration, code: value } })),
    onSuccess: (result) => {
      if (result.next_action === "payment") {
        // Straight to the gateway when the backend already opened a checkout.
        if (result.checkout_url) window.location.assign(result.checkout_url)
        else router.push(paymentPath)
        return
      }
      router.push(statusPath)
    },
    onError: (error) => {
      setCode("")
      if (!isApiError(error)) {
        setProblem({ tone: "error", title: "Something went wrong", body: "Try again in a moment." })
        return
      }
      switch (error.code) {
        case "verification_code_invalid": {
          const left = error.details.attempts_left
          setCodeError(
            typeof left === "number" && left > 0
              ? `That code isn't right. ${left} ${left === 1 ? "attempt" : "attempts"} left.`
              : "Too many wrong codes. Send a new code to try again."
          )
          return
        }
        case "verification_expired":
          setCodeError("This code has expired. Send a new code.")
          return
        case "registration_already_verified":
          router.replace(statusPath)
          return
        case "not_found":
          setProblem({ tone: "error", title: "Sign-up not found", body: "This link is no longer valid. Start again from the pricing page." })
          return
        default:
          setProblem({ tone: "error", title: "We couldn't verify the code", body: error.message || "Try again in a moment." })
      }
    },
  })

  const resend = useMutation({
    mutationFn: async () => unwrap(api.POST("/register/resend", { body: { registration_id: registration } })),
    onSuccess: () => {
      setCooldown(RESEND_SECONDS)
      setCodeError(null)
      setProblem({ tone: "info", title: "New code sent", body: "Check your inbox. The previous code no longer works." })
    },
    onError: (error) => {
      if (isApiError(error) && error.status === 429) {
        setCooldown(error.retryAfter ?? RESEND_SECONDS)
        return
      }
      if (isApiError(error) && error.code === "registration_not_pending") {
        router.replace(statusPath)
        return
      }
      setProblem({ tone: "error", title: "We couldn't send a new code", body: "Try again in a moment." })
    },
  })

  function submit(value: string) {
    setCodeError(null)
    setProblem(null)
    verify.mutate(value)
  }

  // A link that carries the code verifies without a click (once, even in Strict Mode).
  useEffect(() => {
    if (initialCode && !autoSubmitted.current) {
      autoSubmitted.current = true
      submit(initialCode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for the link's code
  }, [initialCode])

  const busy = verify.isPending || verify.isSuccess

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent a six-digit code to {email ? <span className="font-medium text-foreground">{email}</span> : "your email"}. Enter it below to
          create your store.
        </p>
      </header>

      {problem ? (
        <Alert variant={problem.tone === "info" ? "default" : "destructive"}>
          <Icon name={problem.tone === "info" ? "mail" : "error"} />
          <AlertTitle>{problem.title}</AlertTitle>
          <AlertDescription>{problem.body}</AlertDescription>
        </Alert>
      ) : null}

      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault()
          if (code.length === 6) submit(code)
          else setCodeError("Enter all six digits.")
        }}
      >
        <Field data-invalid={codeError ? true : undefined}>
          <FieldLabel htmlFor="code">Verification code</FieldLabel>
          <InputOTP
            id="code"
            maxLength={6}
            pattern="^\d+$"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus={!initialCode}
            value={code}
            disabled={busy}
            onChange={(value) => {
              setCode(value)
              setCodeError(null)
            }}
            onComplete={(value: string) => submit(value)}
            aria-invalid={codeError ? true : undefined}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} aria-invalid={codeError ? true : undefined} />
              <InputOTPSlot index={1} aria-invalid={codeError ? true : undefined} />
              <InputOTPSlot index={2} aria-invalid={codeError ? true : undefined} />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} aria-invalid={codeError ? true : undefined} />
              <InputOTPSlot index={4} aria-invalid={codeError ? true : undefined} />
              <InputOTPSlot index={5} aria-invalid={codeError ? true : undefined} />
            </InputOTPGroup>
          </InputOTP>
          {codeError ? <FieldError>{codeError}</FieldError> : <FieldDescription>The code is valid for 24 hours.</FieldDescription>}
        </Field>

        <Button type="submit" size="lg" disabled={busy} className="w-full">
          {busy ? <Spinner data-icon="inline-start" /> : null}
          {busy ? "Verifying…" : "Verify and continue"}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        Didn&apos;t get it? Check your spam folder or{" "}
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 align-baseline"
          disabled={cooldown > 0 || resend.isPending || busy}
          onClick={() => resend.mutate()}
        >
          {cooldown > 0 ? `send a new code in ${cooldown}s` : "send a new code"}
        </Button>
        .
      </p>
    </div>
  )
}
