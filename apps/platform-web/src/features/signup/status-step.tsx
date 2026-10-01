"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { ButtonLink } from "@workspace/ui/components/button-link"
import { Spinner } from "@workspace/ui/components/spinner"
import { Icon } from "@workspace/ui/icons"

import { slugFromDomain } from "./model"
import { useRegistrationStatus } from "./registration-status"
import { useSignupEmail } from "./signup-store"

const POLL_MS = 15_000
const GIVE_UP_MS = 10 * 60_000
/** After returning from checkout, the payment webhook usually lands within seconds. */
const CONFIRM_POLL_MS = 5_000
const CONFIRM_MS = 90_000

/** Statuses after which polling stops. */
const SETTLED = new Set(["active", "provisioning_failed", "awaiting_payment", "suspended", "closed", "purged"])

/**
 * Steps 5 and 6 of sign-up (spec §24.3): polls the registration every 15
 * seconds while the store is being provisioned, stops after 10 minutes, and
 * links to the new store's admin once it is active. Back from checkout
 * (`?reference=`), it waits for the payment to be confirmed before asking
 * for payment again.
 */
export function StatusStep({
  registration,
  adminUrlTemplate,
  supportEmail,
  returnedFromPayment = false,
}: {
  registration: string
  adminUrlTemplate: string
  supportEmail: string | null
  returnedFromPayment?: boolean
}) {
  const [startedAt] = useState(() => Date.now())
  const [gaveUp, setGaveUp] = useState(false)
  const [confirming, setConfirming] = useState(returnedFromPayment)
  const email = useSignupEmail(registration)

  useEffect(() => {
    const timer = setTimeout(() => setGaveUp(true), GIVE_UP_MS)
    return () => clearTimeout(timer)
  }, [startedAt])

  useEffect(() => {
    if (!returnedFromPayment) return
    const timer = setTimeout(() => setConfirming(false), CONFIRM_MS)
    return () => clearTimeout(timer)
  }, [returnedFromPayment])

  const status = useRegistrationStatus(registration, {
    refetchInterval: (query) => {
      const data = query.state.data
      if (gaveUp) return false
      if (data?.registration_status === "pending_verification") return false
      if (data?.tenant_status === "awaiting_payment" && confirming) return CONFIRM_POLL_MS
      if (data?.tenant_status && SETTLED.has(data.tenant_status)) return false
      return POLL_MS
    },
  })

  if (status.isPending) return <Working title="Checking your store…" body="This only takes a moment." />

  if (status.isError || !status.data) {
    return (
      <Problem title="We couldn't find this sign-up" body="The link may be out of date.">
        <ButtonLink variant="outline" render={<Link href="/pricing" />}>
          Back to pricing
        </ButtonLink>
      </Problem>
    )
  }

  const { registration_status: registrationStatus, tenant_status: tenantStatus, domain } = status.data
  const encoded = encodeURIComponent(registration)

  if (registrationStatus === "pending_verification") {
    return (
      <Problem title="Verify your email first" body="Enter the code we emailed you to create your store." tone="info">
        <ButtonLink render={<Link href={`/register/verify?registration=${encoded}`} />}>
          Enter the code
        </ButtonLink>
      </Problem>
    )
  }

  if (registrationStatus === "expired") {
    return (
      <Problem title="This sign-up has expired" body="The verification window closed. Start a new sign-up to create your store.">
        <ButtonLink render={<Link href="/pricing" />}>
          Start again
        </ButtonLink>
      </Problem>
    )
  }

  if (tenantStatus === "awaiting_payment" && confirming) {
    return <Working title="Confirming your payment…" body="This usually takes a few seconds. Please keep this page open." />
  }

  if (tenantStatus === "awaiting_payment") {
    return (
      <Problem
        title="Payment needed"
        body={
          returnedFromPayment
            ? "We haven't received confirmation of your payment yet. If you completed it, it can take a few minutes to arrive and we'll email you when your store is ready. If you didn't finish paying, continue below."
            : "Your store is waiting for its first payment."
        }
        tone="info"
      >
        <ButtonLink render={<Link href={`/signup/payment?registration=${encoded}`} />}>
          Complete payment
        </ButtonLink>
      </Problem>
    )
  }

  if (tenantStatus === "active") {
    const slug = slugFromDomain(domain)
    const adminUrl = slug ? new URL("/login", adminUrlTemplate.replace("{slug}", slug)) : null
    if (adminUrl && email) adminUrl.searchParams.set("email", email)

    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon name="success" className="size-6" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Your store is ready</h1>
          {domain ? <p className="text-sm text-muted-foreground">It lives at {domain}.</p> : null}
        </div>
        {adminUrl ? (
          <ButtonLink size="lg" className="w-full" render={<a href={adminUrl.toString()} />}>
            Open your admin
            <Icon name="arrowRight" data-icon="inline-end" />
          </ButtonLink>
        ) : null}
        <p className="text-xs text-muted-foreground">Sign in with the email and password you just chose.</p>
      </div>
    )
  }

  if (tenantStatus === "provisioning_failed") {
    return (
      <Problem
        title="We hit a problem setting up your store"
        body={`Our team has been notified and will finish the setup. We'll email you when it's ready${supportEmail ? `, or contact ${supportEmail}` : ""}.`}
      />
    )
  }

  if (tenantStatus && tenantStatus !== "provisioning") {
    return <Problem title="This store isn't available" body="Contact support if you think this is a mistake." />
  }

  if (gaveUp) {
    return (
      <Problem
        tone="info"
        title="This is taking longer than usual"
        body="You can close this page. We'll email you as soon as your store is ready."
      />
    )
  }

  return <Working title="Setting up your store" body="We're creating your store and its admin. This usually takes under a minute." />
}

function Working({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center" role="status" aria-live="polite">
      <Spinner className="size-8 text-primary" />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}

function Problem({ title, body, tone = "error", children }: { title: string; body: string; tone?: "error" | "info"; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <Alert variant={tone === "error" ? "destructive" : "default"}>
        <Icon name={tone === "error" ? "error" : "info"} />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{body}</AlertDescription>
      </Alert>
      {children}
    </div>
  )
}
