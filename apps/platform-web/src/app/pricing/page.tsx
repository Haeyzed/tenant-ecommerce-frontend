import type { Metadata } from "next"

import { PlanGrid } from "@/features/pricing/plan-grid"
import { SignupPaused } from "@/features/signup/signup-paused"
import { loadPlans, loadPlatformConfig } from "@/server/api"

export const metadata: Metadata = { title: "Pricing" }

type Props = { searchParams: Promise<{ interval?: string; ref?: string }> }

/** Plans and prices with a monthly and yearly toggle (spec §24.1, §24.3 step 1). */
export default async function PricingPage({ searchParams }: Props) {
  const [{ interval, ref }, plans, config] = await Promise.all([searchParams, loadPlans(), loadPlatformConfig()])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 sm:py-16">
      <header className="flex max-w-2xl flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Simple plans that grow with you</h1>
        <p className="text-muted-foreground">Pick a plan to create your store. You can change plans at any time from your admin.</p>
      </header>

      {config.registrationEnabled ? (
        <PlanGrid plans={plans} initialInterval={interval === "yearly" ? "yearly" : "monthly"} referral={ref ?? null} />
      ) : (
        <SignupPaused supportEmail={config.supportEmail} />
      )}
    </div>
  )
}
