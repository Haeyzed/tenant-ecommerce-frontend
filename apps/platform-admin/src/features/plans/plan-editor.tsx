"use client"

import { useQuery } from "@tanstack/react-query"
import { parseAsStringLiteral, useQueryState } from "nuqs"
import { useState } from "react"

import { useCan } from "@workspace/access/react"
import { ErrorState } from "@workspace/admin-kit/states"
import { isApiError } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { toast } from "@workspace/ui/components/toast"

import { planQuery, useDeactivatePlan, useUpdatePlan, type Plan } from "./api"
import { FeaturesTab } from "./features-tab"
import { LimitsTab } from "./limits-tab"
import { PlanForm } from "./plan-form"
import { PricesTab } from "./prices-tab"

const TABS = ["details", "prices", "features", "limits"] as const

/** One plan: details, prices, features and limits in tabs (spec §25.1). */
export function PlanEditor({ planId }: { planId: number }) {
  const query = useQuery(planQuery(planId))
  const [tab, setTab] = useQueryState("tab", parseAsStringLiteral(TABS).withDefault("details"))

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} size="page" />

  const plan = query.data

  return (
    <>
      <PageHeader
        title={plan.name}
        description={plan.tagline ?? undefined}
        meta={
          <>
            <StatusBadge tone={plan.active ? "success" : "muted"}>{plan.active ? "Active" : "Inactive"}</StatusBadge>
            {plan.active && !plan.public ? <StatusBadge tone="neutral">Hidden</StatusBadge> : null}
            {plan.recommended ? <StatusBadge tone="info">Recommended</StatusBadge> : null}
          </>
        }
        actions={<ActivationAction plan={plan} />}
      />
      <Tabs value={tab} onValueChange={(value) => void setTab(TABS.find((t) => t === value) ?? "details")}>
        <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="prices">Prices ({plan.prices.filter((p) => p.active).length})</TabsTrigger>
          <TabsTrigger value="features">Features ({plan.features.length})</TabsTrigger>
          <TabsTrigger value="limits">Limits</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="pt-4">
          <PlanForm key={plan.id} plan={plan} />
        </TabsContent>
        <TabsContent value="prices" className="pt-4">
          <PricesTab plan={plan} />
        </TabsContent>
        <TabsContent value="features" className="pt-4">
          <FeaturesTab plan={plan} />
        </TabsContent>
        <TabsContent value="limits" className="pt-4">
          <LimitsTab plan={plan} />
        </TabsContent>
      </Tabs>
    </>
  )
}

/**
 * Activating needs an active price and every limit set; deactivating stops
 * new subscriptions only (spec §11.6).
 */
function ActivationAction({ plan }: { plan: Plan }) {
  const update = useUpdatePlan(plan.id)
  const deactivate = useDeactivatePlan(plan.id)
  const [confirm, setConfirm] = useState(false)
  const canUpdate = useCan("landlord.plans.update")
  const canDeactivate = useCan("landlord.plans.deactivate")
  const hasPrice = plan.prices.some((p) => p.active)

  async function activate() {
    try {
      await update.mutateAsync({ is_active: true })
      toast.add({ title: `${plan.name} is active`, description: plan.public ? "It now appears on the pricing page." : "It is hidden from the pricing page.", type: "success" })
    } catch (error) {
      toast.add({ title: "Couldn't activate the plan", description: isApiError(error) ? error.message : undefined, type: "error" })
    }
  }

  async function runDeactivate() {
    try {
      await deactivate.mutateAsync()
      toast.add({ title: `${plan.name} deactivated`, type: "success" })
      setConfirm(false)
    } catch (error) {
      toast.add({ title: "Couldn't deactivate the plan", description: isApiError(error) ? error.message : undefined, type: "error" })
    }
  }

  if (!plan.active) {
    if (!canUpdate) return null
    return (
      <Button onClick={() => void activate()} disabled={update.isPending || !hasPrice} title={hasPrice ? undefined : "Add an active price first"}>
        Activate plan
      </Button>
    )
  }

  if (!canDeactivate) return null
  return (
    <>
      <Button variant="outline" onClick={() => setConfirm(true)}>
        Deactivate
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Deactivate ${plan.name}?`}
        description="New stores can no longer choose it and it leaves the pricing page. Stores already on it keep their subscription."
        confirmLabel="Deactivate"
        destructive
        pending={deactivate.isPending}
        onConfirm={() => void runDeactivate()}
      />
    </>
  )
}
