import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthLayout, LoginForm } from "@workspace/admin-kit/auth"
import { safeNext } from "@workspace/bff/paths"

import { platformBrand } from "@/features/auth/brand"
import { getServerContext, loadBranding } from "@/server/api"

export const metadata: Metadata = { title: "Sign in" }

type Props = { searchParams: Promise<{ next?: string; expired?: string; email?: string }> }

export default async function LoginPage({ searchParams }: Props) {
  const [{ next, expired, email }, branding, ctx] = await Promise.all([searchParams, loadBranding(), getServerContext()])

  // Already signed in: go straight to the console.
  if (ctx?.session && expired !== "1") redirect(safeNext(next, "/dashboard"))

  return (
    <AuthLayout
      brand={platformBrand(
        branding,
        "Every store on the platform, in one console.",
        "Tenants, plans, billing, affiliates and platform settings, with access scoped to your role."
      )}
      title="Sign in"
      description="Platform staff only. Use the account your administrator invited."
    >
      <LoginForm next={next} expired={expired === "1"} initialEmail={email ?? ""} home="/dashboard" />
    </AuthLayout>
  )
}
