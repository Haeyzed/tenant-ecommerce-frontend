import type { Metadata } from "next"

import { AuthLayout, FullPageState, ForgotPasswordForm } from "@workspace/admin-kit/auth"

import { loadStoreBranding } from "@/server/api"

export const metadata: Metadata = { title: "Reset your password" }

export default async function ForgotPasswordPage() {
  const branding = await loadStoreBranding()

  if (branding.kind === "not-found") {
    return <FullPageState icon="store" title="Store not found" description="There is no store at this address." />
  }

  return (
    <AuthLayout
      brand={{
        name: branding.kind === "ok" ? branding.branding.name : "Store admin",
        logoUrl: branding.kind === "ok" ? branding.branding.logoUrl : null,
        caption: "Store administration",
        headline: "Back in within a minute.",
        blurb: "We'll email you a secure link to choose a new password.",
      }}
      title="Reset your password"
      description="Enter the email you sign in with."
    >
      <ForgotPasswordForm />
    </AuthLayout>
  )
}
