import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { INTERVAL_LABELS, findPrice } from "@/features/signup/model"
import { SignupForm } from "@/features/signup/signup-form"
import { SignupPaused } from "@/features/signup/signup-paused"
import { SignupSteps } from "@/features/signup/signup-steps"
import { loadLegalDocuments, loadPlans, loadPlatformConfig } from "@/server/api"

export const metadata: Metadata = { title: "Create your store" }

type Props = { searchParams: Promise<{ price?: string; ref?: string }> }

/** Step 2 of sign-up (spec §24.3). The chosen price comes from /pricing in the URL. */
export default async function SignupPage({ searchParams }: Props) {
  const { price, ref } = await searchParams
  const priceId = Number(price)
  if (!Number.isInteger(priceId) || priceId <= 0) redirect("/pricing")

  const [plans, documents, config] = await Promise.all([loadPlans(), loadLegalDocuments(), loadPlatformConfig()])
  const chosen = findPrice(plans, priceId)
  if (chosen === null) redirect("/pricing")

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-10 sm:py-14">
      <SignupSteps current="details" />
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Create your store</h1>
        <p className="text-sm text-muted-foreground">
          You chose <span className="font-medium text-foreground">{chosen.plan.name}</span>.{" "}
          <Link href="/pricing" className="underline underline-offset-4 hover:text-foreground">
            Change plan
          </Link>
        </p>
      </header>

      {config.registrationEnabled ? (
        <SignupForm
          priceId={chosen.price.id}
          planSummary={{
            name: chosen.plan.name,
            amount: chosen.price.amount,
            currency: chosen.price.currencyCode,
            interval: INTERVAL_LABELS[chosen.price.interval] ?? chosen.price.interval,
            trialDays: chosen.price.trialDays,
          }}
          documents={documents}
          referral={ref ?? null}
        />
      ) : (
        <SignupPaused supportEmail={config.supportEmail} />
      )}
    </div>
  )
}
