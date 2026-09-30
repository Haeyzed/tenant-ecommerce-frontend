import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { safeNext } from "@workspace/bff/paths"

import { AuthLayout } from "@/features/auth/components/auth-layout"
import { LoginForm } from "@/features/auth/components/login-form"
import { FullPageState } from "@/features/auth/components/store-unavailable"
import { getServerContext, loadStoreBranding } from "@/server/api"

export const metadata: Metadata = { title: "Sign in" }

type Props = { searchParams: Promise<{ next?: string; expired?: string }> }

export default async function LoginPage({ searchParams }: Props) {
  const [{ next, expired }, branding, ctx] = await Promise.all([
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
      branding={branding.kind === "ok" ? branding.branding : null}
      title="Sign in"
      description="Use the email and password your store owner set up for you."
    >
      <LoginForm next={next} expired={expired === "1"} />
    </AuthLayout>
  )
}
