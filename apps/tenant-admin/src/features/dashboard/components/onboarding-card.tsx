"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"
import { Icon, type IconName } from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"

import { onboardingQuery } from "../api/queries"

/** Labels and destinations for the backend's checklist keys (OnboardingService). */
const STEPS: Record<
  string,
  { label: string; description: string; href: string; icon: IconName }
> = {
  store_details: {
    label: "Add your logo and phone number",
    description: "Customers see them on your store and receipts.",
    href: "/settings/store",
    icon: "store",
  },
  first_product: {
    label: "Add your first product",
    description: "Start building your catalogue.",
    href: "/products/new",
    icon: "products",
  },
  tax: {
    label: "Set up tax",
    description: "Add tax rates or confirm you don't charge tax.",
    href: "/settings/tax",
    icon: "tax",
  },
  shipping: {
    label: "Set up shipping",
    description: "Add a shipping method for physical products.",
    href: "/settings/shipping",
    icon: "shipping",
  },
  policies: {
    label: "Publish your store policies",
    description: "Privacy, terms and refunds.",
    href: "/cms/pages",
    icon: "file",
  },
  custom_domain: {
    label: "Connect your own domain",
    description: "Optional: use your own web address.",
    href: "/settings/domains",
    icon: "globe",
  },
}

/** The owner's setup checklist (spec §27.3), shown until every required step is done. */
export function OnboardingCard() {
  const { data } = useQuery(onboardingQuery())

  if (!data || data.dismissed || data.completed >= data.total) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Finish setting up your store</CardTitle>
        <CardDescription>
          {data.completed} of {data.total} steps done
        </CardDescription>
        <Progress
          value={(data.completed / Math.max(data.total, 1)) * 100}
          className="mt-2"
          aria-label="Setup progress"
        />
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.steps.map((step) => {
            const meta = STEPS[step.key]
            if (!meta) return null

            return (
              <li key={step.key}>
                <Link
                  href={meta.href}
                  className={cn(
                    "group flex h-full items-start gap-3 rounded-lg border p-3 transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50",
                    step.complete && "opacity-60"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                      step.complete ? "bg-success/15 text-success" : "bg-muted"
                    )}
                  >
                    <Icon
                      name={step.complete ? "check" : meta.icon}
                      className="size-4"
                    />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        step.complete && "line-through"
                      )}
                    >
                      {meta.label}
                      {step.optional ? (
                        <span className="ms-1 font-normal text-muted-foreground">
                          (optional)
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {meta.description}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
