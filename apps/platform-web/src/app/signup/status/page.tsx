import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { env } from "@/env"
import { isRegistrationId } from "@/features/signup/model"
import { SignupSteps } from "@/features/signup/signup-steps"
import { StatusStep } from "@/features/signup/status-step"
import { loadPlatformConfig } from "@/server/api"

export const metadata: Metadata = { title: "Setting up your store", robots: { index: false } }

type Props = { searchParams: Promise<{ registration?: string; reference?: string }> }

/** Steps 5 and 6 of sign-up: provisioning progress, then the link to the new admin (spec §24.3). */
export default async function StatusPage({ searchParams }: Props) {
  const [{ registration, reference }, config] = await Promise.all([searchParams, loadPlatformConfig()])
  if (!registration || !isRegistrationId(registration)) redirect("/pricing")

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-10 sm:py-14">
      <SignupSteps current="setup" />
      <StatusStep registration={registration} adminUrlTemplate={env.TENANT_ADMIN_URL} supportEmail={config.supportEmail} returnedFromPayment={Boolean(reference)} />
    </div>
  )
}
