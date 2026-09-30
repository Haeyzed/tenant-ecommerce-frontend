"use client"

import { useQuery } from "@tanstack/react-query"
import { parseAsStringLiteral, useQueryState } from "nuqs"
import { useState } from "react"

import { useCan } from "@workspace/access/react"
import { ErrorState } from "@workspace/admin-kit/states"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Icon } from "@workspace/ui/icons"

import { gatewaysQuery, type Gateway, type Mode } from "./api"
import { CredentialsSheet } from "./credentials-sheet"
import { GatewayCard } from "./gateway-card"
import { ModeDialog } from "./mode-dialog"

const MODES = ["test", "live"] as const

/**
 * The platform's own billing gateways (spec §25.1, §15.9, §15.10): keys per
 * provider and mode, the test step that unlocks enabling, the default
 * gateway, each webhook URL, and the platform-wide billing mode.
 */
export function PaymentGatewaysPage() {
  const query = useQuery(gatewaysQuery)
  const [tab, setTab] = useQueryState("mode", parseAsStringLiteral(MODES))
  const [editing, setEditing] = useState<Gateway | null>(null)
  const [modeOpen, setModeOpen] = useState(false)
  const canSwitch = useCan("landlord.billing.payment-gateways.mode")

  const billingMode = query.data?.billingMode ?? "test"
  const shown: Mode = tab ?? billingMode
  const other: Mode = billingMode === "live" ? "test" : "live"
  const gateways = (query.data?.gateways ?? []).filter((g) => g.mode === shown)
  const enabledInBillingMode = (query.data?.gateways ?? []).filter((g) => g.mode === billingMode && g.enabled)

  return (
    <>
      <PageHeader
        title="Payment gateways"
        description="The keys the platform uses to charge stores for their subscriptions. Store checkouts use each store's own gateways."
        meta={query.data ? <StatusBadge tone={billingMode === "live" ? "success" : "warning"}>{billingMode === "live" ? "Live billing" : "Test billing"}</StatusBadge> : null}
        actions={
          canSwitch && query.data ? (
            <Button variant="outline" onClick={() => setModeOpen(true)}>
              <Icon name="refresh" data-icon="inline-start" />
              Switch to {other}
            </Button>
          ) : null
        }
      />

      {query.data && enabledInBillingMode.length === 0 ? (
        <Alert variant="destructive">
          <Icon name="alert" />
          <AlertTitle>No gateway can take payments</AlertTitle>
          <AlertDescription>
            Billing is in {billingMode} mode but no {billingMode} gateway is enabled, so paid sign-ups and renewals can&apos;t be charged. Connect and enable one below.
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={shown} onValueChange={(value) => void setTab(value === billingMode ? null : value === "live" ? "live" : "test")}>
        <TabsList>
          <TabsTrigger value="test">Test keys</TabsTrigger>
          <TabsTrigger value="live">Live keys</TabsTrigger>
        </TabsList>
      </Tabs>

      {query.isPending ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {gateways.map((gateway) => (
            <GatewayCard key={`${gateway.provider}:${gateway.mode}`} gateway={gateway} onEdit={() => setEditing(gateway)} />
          ))}
        </div>
      )}

      <CredentialsSheet gateway={editing} onClose={() => setEditing(null)} />
      <ModeDialog open={modeOpen} onOpenChange={setModeOpen} target={other} />
    </>
  )
}
