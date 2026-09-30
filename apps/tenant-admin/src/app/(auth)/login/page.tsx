import type { Metadata } from "next"
import { redirect } from "next/navigation"

import {
  AuthLayout,
  FullPageState,
  LoginForm,
  type Problem,
} from "@workspace/admin-kit/auth"
import { safeNext } from "@workspace/bff/paths"

import { getServerContext, loadStoreBranding } from "@/server/api"

export const metadata: Metadata = { title: "Sign in" }

/** Tenant states the login can reveal (spec §9.2 step 5, §11.4). */
const TENANT_STATES: Record<string, Problem> = {
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
  maintenance: { title: "Down for maintenance", body: "We'll be back shortly." },
}

type Props = {
  searchParams: Promise<{ next?: string; expired?: string; email?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const [{ next, expired, email }, branding, ctx] = await Promise.all([
    searchParams,
    loadStoreBranding(),
    getServerContext(),
  ])

  if (branding.kind === "not-found") {
    return (
      <FullPageState
        icon="store"
        title="Store not found"
        description="There is no store at this address. Check the link you were given."
      />
    )
  }

  // Already signed in: go straight to the admin.
  if (ctx?.session && expired !== "1") redirect(safeNext(next, "/"))

  return (
    <AuthLayout
      brand={{
        name: branding.kind === "ok" ? branding.branding.name : "Store admin",
        logoUrl: branding.kind === "ok" ? branding.branding.logoUrl : null,
        caption: "Store administration",
        headline: "Run your whole store from one place.",
        blurb:
          "Orders, catalogue, customers, inventory and every module your plan includes, with your team's access kept exactly where you set it.",
      }}
      title="Sign in"
      description="Use the email and password your store owner set up for you."
    >
      <LoginForm
        next={next}
        expired={expired === "1"}
        initialEmail={email ?? ""}
        states={TENANT_STATES}
      />
    </AuthLayout>
  )
}
