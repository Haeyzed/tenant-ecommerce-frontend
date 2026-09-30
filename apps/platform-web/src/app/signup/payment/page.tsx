import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { isRegistrationId } from "@/features/signup/model"
import { PaymentStep } from "@/features/signup/payment-step"
import { SignupSteps } from "@/features/signup/signup-steps"

export const metadata: Metadata = { title: "Payment", robots: { index: false } }

type Props = { searchParams: Promise<{ registration?: string }> }

export default async function PaymentPage({ searchParams }: Props) {
  const { registration } = await searchParams
  if (!registration || !isRegistrationId(registration)) redirect("/pricing")

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-10 sm:py-14">
      <SignupSteps current="setup" />
      <PaymentStep registration={registration} />
    </div>
  )
}
