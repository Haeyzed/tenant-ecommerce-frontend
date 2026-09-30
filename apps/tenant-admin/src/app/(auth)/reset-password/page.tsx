import type { Metadata } from "next"

import { AuthLayout, FullPageState, ResetPasswordForm } from "@workspace/admin-kit/auth"

import { loadStoreBranding } from "@/server/api"

export const metadata: Metadata = { title: "Choose a new password" }

type Props = { searchParams: Promise<{ token?: string; email?: string }> }

/** The backend's reset link path (spec §3.8). */
export default async function ResetPasswordPage({ searchParams }: Props) {
  const [{ token, email }, branding] = await Promise.all([searchParams, loadStoreBranding()])

  if (branding.kind === "not-found") {
    return <FullPageState icon="store" title="Store not found" description="There is no store at this address." />
  }

  return (
    <AuthLayout
      brand={{
        name: branding.kind === "ok" ? branding.branding.name : "Store admin",
        logoUrl: branding.kind === "ok" ? branding.branding.logoUrl : null,
        caption: "Store administration",
        headline: "Choose a new password.",
        blurb: "Your other sessions stay signed out until you sign in again.",
      }}
      title="Choose a new password"
      description="Use at least 8 characters."
    >
      <ResetPasswordForm token={token ?? ""} email={email ?? ""} />
    </AuthLayout>
  )
}
