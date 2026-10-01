"use client"

import { useQuery } from "@tanstack/react-query"
import { parseAsStringLiteral, useQueryState } from "nuqs"

import { useCan } from "@workspace/access/react"
import { BILLING_MODES } from "@workspace/admin-kit/dashboard"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Icon } from "@workspace/ui/icons"

import { gatewaysQuery } from "@/features/payment-gateways/api"

/**
 * Money figures (subscriptions, MRR, revenue, payments) read one billing
 * mode at a time (§22.1 `mode`). Viewing test data is flagged so it is
 * never mistaken for real money; viewing live data while billing is in
 * test mode offers the switch, since new sign-ups are then test data.
 */
export function TestModeNotice() {
  const [mode, setMode] = useQueryState("mode", parseAsStringLiteral(BILLING_MODES).withDefault("live"))
  const canSeeGateways = useCan("landlord.billing.payment-gateways.index")
  const gateways = useQuery({ ...gatewaysQuery, enabled: canSeeGateways && mode === "live" })

  if (mode === "test") {
    return (
      <Alert className="border-warning/40 bg-warning/5">
        <Icon name="alert" className="text-warning" />
        <AlertTitle>Showing test data</AlertTitle>
        <AlertDescription>Subscriptions, MRR, revenue and payments come from test gateways. No real money is included. Tenant counts include every store.</AlertDescription>
        <AlertAction>
          <Button size="sm" variant="outline" onClick={() => void setMode(null)}>
            Show live data
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  if (gateways.data?.billingMode !== "test") return null

  return (
    <Alert>
      <Icon name="info" />
      <AlertTitle>Billing is in test mode</AlertTitle>
      <AlertDescription>New sign-ups and payments are test data, so they don&apos;t appear in the live money figures.</AlertDescription>
      <AlertAction>
        <Button size="sm" variant="outline" onClick={() => void setMode("test")}>
          Show test data
        </Button>
      </AlertAction>
    </Alert>
  )
}
