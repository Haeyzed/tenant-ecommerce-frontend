import type { Metadata } from "next"

import { AuthLayout, ResetPasswordForm } from "@workspace/admin-kit/auth"

import { platformBrand } from "@/features/auth/brand"
import { loadBranding } from "@/server/api"

export const metadata: Metadata = { title: "Choose a password" }

type Props = { searchParams: Promise<{ token?: string; email?: string }> }

/**
 * The backend's reset link. Platform-user invitations use the same link to
 * set the first password (spec §9.4).
 */
export default async function ResetPasswordPage({ searchParams }: Props) {
  const [{ token, email }, branding] = await Promise.all([searchParams, loadBranding()])

  return (
    <AuthLayout
      brand={platformBrand(branding, "Choose your password.", "New here? This sets the password for the account you were invited to.")}
      title="Choose a password"
      description="Use at least 8 characters, with letters and numbers."
    >
      <ResetPasswordForm token={token ?? ""} email={email ?? ""} />
    </AuthLayout>
  )
}
