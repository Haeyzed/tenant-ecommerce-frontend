import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { isRegistrationId } from "@/features/signup/model"
import { SignupSteps } from "@/features/signup/signup-steps"
import { VerifyForm } from "@/features/signup/verify-form"

export const metadata: Metadata = { title: "Verify your email", robots: { index: false } }

type Props = { searchParams: Promise<{ registration?: string; code?: string }> }

/** Step 3 of sign-up: the backend's email link path (spec §24.3, D-141). */
export default async function VerifyPage({ searchParams }: Props) {
  const { registration, code } = await searchParams
  if (!registration || !isRegistrationId(registration)) redirect("/pricing")

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-10 sm:py-14">
      <SignupSteps current="verify" />
      <VerifyForm registration={registration} initialCode={code && /^\d{6}$/.test(code) ? code : null} />
    </div>
  )
}
