"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"

import { useCan } from "@workspace/access/react"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Icon } from "@workspace/ui/icons"

import { gatewaysQuery } from "@/features/payment-gateways/api"

/**
 * Subscription, MRR, revenue and payment figures count live money only
 * (the metrics filter on live mode, and test subscriptions record no MRR,
 * spec §14.10). While billing is in test mode, sign-ups and payments made in
 * testing therefore never appear; say so instead of showing silent zeros.
 */
export function TestModeNotice() {
  const canSee = useCan("landlord.billing.payment-gateways.index")
  const gateways = useQuery({ ...gatewaysQuery, enabled: canSee })

  if (gateways.data?.billingMode !== "test") return null

  return (
    <Alert>
      <Icon name="info" />
      <AlertTitle>Billing is in test mode</AlertTitle>
      <AlertDescription>
        Subscriptions, MRR, revenue and payments count live payments only, so stores and payments created in test mode don&apos;t appear in
        those figures. Tenant counts and sign-ups include every store.{" "}
        <Link href="/payment-gateways" className="underline underline-offset-4">
          Payment gateways
        </Link>
      </AlertDescription>
    </Alert>
  )
}
