import type { Metadata } from "next"

import { AuthLayout, ForgotPasswordForm } from "@workspace/admin-kit/auth"

import { platformBrand } from "@/features/auth/brand"
import { loadBranding } from "@/server/api"

export const metadata: Metadata = { title: "Reset your password" }

export default async function ForgotPasswordPage() {
  const branding = await loadBranding()

  return (
    <AuthLayout
      brand={platformBrand(branding, "Back in within a minute.", "We'll email you a secure link to choose a new password.")}
      title="Reset your password"
      description="Enter the email you sign in with."
    >
      <ForgotPasswordForm />
    </AuthLayout>
  )
}
