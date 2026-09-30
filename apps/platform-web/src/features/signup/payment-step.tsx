"use client"

import { useMutation } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { isApiError, unwrap } from "@workspace/api-client"
import type { operations } from "@workspace/contract/landlord"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldContent, FieldDescription, FieldLabel, FieldSet, FieldLegend } from "@workspace/ui/components/field"
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { Icon } from "@workspace/ui/icons"

import { useRegistrationStatus } from "./registration-status"
import { api } from "@/shell/api-client"

type Gateway = operations["landlord.register.checkout"]["requestBody"]["content"]["application/json"]["gateway"]

const GATEWAYS: { value: Gateway; label: string; description: string }[] = [
  { value: "paystack", label: "Paystack", description: "Cards, bank transfer and USSD" },
  { value: "flutterwave", label: "Flutterwave", description: "Cards, mobile money and bank transfer" },
  { value: "stripe", label: "Stripe", description: "International cards and wallets" },
]

const isGateway = (value: unknown): value is Gateway => GATEWAYS.some((g) => g.value === value)

/**
 * Step 4 of sign-up (spec §24.3): a fresh checkout after a failed or
 * abandoned payment. Only a store awaiting its first payment can pay here;
 * anything else goes to the status page.
 */
export function PaymentStep({ registration }: { registration: string }) {
  const router = useRouter()
  const status = useRegistrationStatus(registration)
  const [gateway, setGateway] = useState<Gateway>("paystack")
  const [problem, setProblem] = useState<string | null>(null)
  const statusPath = `/signup/status?registration=${encodeURIComponent(registration)}`

  const tenantStatus = status.data?.tenant_status ?? null

  useEffect(() => {
    if (status.data && tenantStatus !== "awaiting_payment") router.replace(statusPath)
  }, [status.data, tenantStatus, router, statusPath])

  const checkout = useMutation({
    mutationFn: async () =>
      unwrap(api.POST("/register/{registration}/checkout", { params: { path: { registration } }, body: { gateway } })),
    onSuccess: (result) => {
      if (result.checkout_url) window.location.assign(result.checkout_url)
      else setProblem("This payment method didn't return a checkout page. Choose another method.")
    },
    onError: (error) => {
      if (isApiError(error) && error.code === "checkout_unavailable") {
        router.replace(statusPath)
        return
      }
      setProblem(
        isApiError(error) && error.status < 500
          ? error.message || "This payment method isn't available. Choose another method."
          : "We couldn't start the payment. Try again in a moment."
      )
    },
  })

  if (status.isPending || (status.data && tenantStatus !== "awaiting_payment")) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (status.isError) {
    return (
      <Alert variant="destructive">
        <Icon name="error" />
        <AlertTitle>We couldn&apos;t find this sign-up</AlertTitle>
        <AlertDescription>
          The link may be out of date. <Link href="/pricing">Start again from pricing</Link>.
        </AlertDescription>
      </Alert>
    )
  }

  const busy = checkout.isPending || checkout.isSuccess

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Complete your payment</h1>
        <p className="text-sm text-muted-foreground">Your email is verified. Pay for your plan to finish setting up your store.</p>
      </header>

      {problem ? (
        <Alert variant="destructive">
          <Icon name="error" />
          <AlertTitle>Payment not started</AlertTitle>
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      ) : null}

      <FieldSet>
        <FieldLegend variant="label">Payment method</FieldLegend>
        <RadioGroup value={gateway} onValueChange={(value) => (isGateway(value) ? setGateway(value) : null)}>
          {GATEWAYS.map((option) => (
            <FieldLabel key={option.value} htmlFor={`gateway-${option.value}`}>
              <Field orientation="horizontal">
                <FieldContent>
                  <span className="font-medium">{option.label}</span>
                  <FieldDescription>{option.description}</FieldDescription>
                </FieldContent>
                <RadioGroupItem id={`gateway-${option.value}`} value={option.value} />
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>
      </FieldSet>

      <Button
        size="lg"
        className="w-full"
        disabled={busy}
        onClick={() => {
          setProblem(null)
          checkout.mutate()
        }}
      >
        {busy ? <Spinner data-icon="inline-start" /> : <Icon name="billing" data-icon="inline-start" />}
        {busy ? "Opening checkout…" : "Continue to payment"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">You&apos;ll be taken to the payment provider&apos;s secure page.</p>
    </div>
  )
}
