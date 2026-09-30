"use client"

import Link from "next/link"
import { useState } from "react"

import { formatMoney } from "@workspace/format"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"
import { Icon } from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"

import { formatLimit, INTERVAL_LABELS, LIMIT_LABELS, type Plan } from "@/features/signup/model"

type Interval = "monthly" | "yearly"

function signupHref(priceId: number, referral: string | null) {
  const params = new URLSearchParams({ price: String(priceId) })
  if (referral) params.set("ref", referral)
  return `/signup?${params.toString()}`
}

/** Plan cards with a monthly and yearly toggle; each card links to /signup?price= (spec §24.3 step 1). */
export function PlanGrid({ plans, initialInterval, referral }: { plans: Plan[]; initialInterval: Interval; referral: string | null }) {
  const [interval, setInterval] = useState<Interval>(initialInterval)
  const hasYearly = plans.some((plan) => plan.prices.some((p) => p.interval === "yearly"))
  const bestSaving = Math.max(0, ...plans.flatMap((plan) => plan.prices.map((p) => p.annualSavingsPercent ?? 0)))

  if (plans.length === 0) {
    return <p className="text-muted-foreground">No plans are available right now.</p>
  }

  return (
    <div className="flex flex-col gap-8">
      {hasYearly ? (
        <div className="flex items-center gap-3">
          <ToggleGroup
            variant="outline"
            value={[interval]}
            onValueChange={(next: string[]) => {
              const value = next[0]
              if (value === "monthly" || value === "yearly") setInterval(value)
            }}
            aria-label="Billing interval"
          >
            <ToggleGroupItem value="monthly">Monthly</ToggleGroupItem>
            <ToggleGroupItem value="yearly">Yearly</ToggleGroupItem>
          </ToggleGroup>
          {bestSaving > 0 ? <span className="text-sm text-muted-foreground">Save up to {bestSaving}% yearly</span> : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const price = plan.prices.find((p) => p.interval === interval) ?? plan.prices[0]
          const limits = Object.entries(plan.limits).filter(([key, value]) => key in LIMIT_LABELS && value !== 0)
          const features = plan.features.flatMap((group) => group.items)

          return (
            <article
              key={plan.id}
              className={cn("flex flex-col gap-6 rounded-xl border bg-card p-6", plan.isRecommended && "border-primary ring-1 ring-primary")}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{plan.name}</h2>
                  {plan.badge || plan.isRecommended ? <Badge>{plan.badge ?? "Recommended"}</Badge> : null}
                </div>
                {plan.tagline ? <p className="text-sm text-muted-foreground">{plan.tagline}</p> : null}
              </div>

              {price ? (
                <div className="flex flex-col gap-1">
                  <p className="flex items-baseline gap-1">
                    <span className="text-3xl font-semibold tabular-nums">{formatMoney(price.amount, price.currencyCode)}</span>
                    <span className="text-sm text-muted-foreground">/ {INTERVAL_LABELS[price.interval] ?? price.interval}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {price.trialDays > 0 ? `${price.trialDays}-day free trial` : "Billed from day one"}
                    {price.annualSavingsPercent ? ` · save ${price.annualSavingsPercent}%` : ""}
                  </p>
                </div>
              ) : null}

              {price ? (
                <Button
                  size="lg"
                  variant={plan.isRecommended ? "default" : "outline"}
                  nativeButton={false}
                  render={<Link href={signupHref(price.id, referral)} />}
                >
                  {price.trialDays > 0 ? "Start free trial" : `Choose ${plan.name}`}
                </Button>
              ) : null}

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {limits.map(([key, value]) => (
                  <div key={key} className="flex flex-col">
                    <dt className="text-muted-foreground">{LIMIT_LABELS[key]}</dt>
                    <dd className="font-medium tabular-nums">{formatLimit(key, value)}</dd>
                  </div>
                ))}
              </dl>

              {features.length > 0 ? (
                <ul className="flex flex-col gap-2 text-sm">
                  {features.map((feature) => (
                    <li key={feature.key} className="flex gap-2">
                      <Icon name="check" className="mt-0.5 size-4 shrink-0 text-primary" />
                      {feature.name}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          )
        })}
      </div>
    </div>
  )
}
