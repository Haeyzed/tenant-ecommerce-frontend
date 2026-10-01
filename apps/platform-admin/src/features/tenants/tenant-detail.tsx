"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { parseAsStringLiteral, useQueryState } from "nuqs"
import { useState } from "react"

import { useCan } from "@workspace/access/react"
import { ErrorState, StateView } from "@workspace/admin-kit/states"
import { isApiError } from "@workspace/api-client"
import { formatDate, formatPercent } from "@workspace/format"
import { Button } from "@workspace/ui/components/button"
import { ButtonLink } from "@workspace/ui/components/button-link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Field, FieldDescription, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { toast } from "@workspace/ui/components/toast"

import { DetailCard } from "@/features/billing/details"
import { INTERVAL_LABELS, ModeBadge, StatusLabel, SUBSCRIPTION_STATUS } from "@/features/billing/labels"
import { useConsole } from "@/shell/console-context"

import { tenantQuery, tenantSettingsQuery, useUpdateTenantSettings, type TenantDetails } from "./api"
import { TENANT_STATUS } from "./labels"
import { LimitsTab } from "./limits-tab"
import { ModulesTab } from "./modules-tab"
import { OverviewTab } from "./overview-tab"
import { TenantActions } from "./tenant-actions"

const TABS = ["overview", "subscription", "modules", "limits", "settings"] as const

/** One store (spec §25.1): overview, subscription, modules, limits and platform settings. */
export function TenantDetail({ id }: { id: string }) {
  const query = useQuery(tenantQuery(id))
  const [tab, setTab] = useQueryState("tab", parseAsStringLiteral(TABS).withDefault("overview"))

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} size="page" />

  const details = query.data
  const t = details.tenant
  const primary = t.domains?.find((d) => d.is_primary)?.domain ?? t.slug

  return (
    <>
      <PageHeader title={t.name} description={primary} meta={<StatusLabel map={TENANT_STATUS} value={t.status} />} actions={<TenantActions tenant={t} />} />
      <Tabs value={tab} onValueChange={(v) => void setTab(TABS.find((x) => x === v) ?? "overview")}>
        <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="limits">Limits</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-4">
          <OverviewTab details={details} />
        </TabsContent>
        <TabsContent value="subscription" className="pt-4">
          <SubscriptionTab details={details} />
        </TabsContent>
        <TabsContent value="modules" className="pt-4">
          <ModulesTab details={details} />
        </TabsContent>
        <TabsContent value="limits" className="pt-4">
          <LimitsTab details={details} />
        </TabsContent>
        <TabsContent value="settings" className="pt-4">
          <SettingsTab tenantId={t.id} />
        </TabsContent>
      </Tabs>
    </>
  )
}

function SubscriptionTab({ details }: { details: TenantDetails }) {
  const { display } = useConsole()
  const s = details.subscription
  if (s === null) return <StateView icon="billing" title="No subscription" description="This store has no current subscription." />

  return (
    <div className="flex flex-col gap-4">
      <DetailCard
        title="Current subscription"
        action={
          <span className="flex flex-wrap gap-1.5">
            <StatusLabel map={SUBSCRIPTION_STATUS} value={s.status} />
            <ModeBadge mode={s.gateway_mode} />
          </span>
        }
        details={[
          { term: "Plan", value: s.plan?.name },
          { term: "Billed", value: `${INTERVAL_LABELS[s.billing_interval] ?? s.billing_interval} in ${s.currency_code}` },
          { term: "Started", value: formatDate(s.starts_at, display) },
          { term: s.status === "trialing" ? "Trial ends" : "Renews", value: formatDate(s.status === "trialing" ? s.trial_ends_at : s.renews_at, display) },
          { term: "Card on file", value: s.has_payment_method ? "Yes" : "No" },
          { term: "Cancelled", value: s.cancelled_at ? formatDate(s.cancelled_at, display) : null },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <ButtonLink variant="outline" render={<Link href={`/subscriptions/${s.id}`} />}>
          Open subscription
        </ButtonLink>
        <ButtonLink variant="outline" render={<Link href={`/payment-transactions?tenant=${encodeURIComponent(details.tenant.id)}`} />}>
          Payments
        </ButtonLink>
        <ButtonLink variant="outline" render={<Link href={`/platform-commissions?tenant=${encodeURIComponent(details.tenant.id)}`} />}>
          Commissions
        </ButtonLink>
      </div>
    </div>
  )
}

/** The store's platform commission rate; empty uses the platform default (spec §13.7). */
function SettingsTab({ tenantId }: { tenantId: string }) {
  const settings = useQuery(tenantSettingsQuery(tenantId))
  const update = useUpdateTenantSettings(tenantId)
  const canUpdate = useCan("landlord.settings.tenant.update")
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (settings.isPending) return <Skeleton className="h-48 w-full" />
  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />

  const stored = settings.data.values.commission_rate
  const storedText = typeof stored === "string" || typeof stored === "number" ? String(Number(stored)) : ""
  const value = draft ?? storedText
  const effective = settings.data.effective_commission_rate

  async function save(next: string | null) {
    setError(null)
    if (next !== null && (!/^\d+(\.\d{1,2})?$/.test(next) || Number(next) > 100)) {
      setError("Enter a percentage from 0 to 100, or leave empty for the platform default.")
      return
    }
    try {
      await update.mutateAsync({ commission_rate: next })
      toast.add({ title: next === null ? "Commission back to the platform default" : "Commission rate saved", type: "success" })
      setDraft(null)
    } catch (e) {
      setError(isApiError(e) ? (e.fieldErrors.commission_rate?.join(" ") ?? e.message) : "Couldn't save. Try again.")
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Platform commission</CardTitle>
        <CardDescription>
          {effective === null
            ? "Commission is switched off for the platform, so this store pays none."
            : `This store currently pays ${formatPercent(effective)} of its sales.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void save(value.trim() === "" ? null : value.trim())
          }}
        >
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="commission-rate">Rate for this store</FieldLabel>
            <InputGroup className="w-40">
              <InputGroupInput
                id="commission-rate"
                inputMode="decimal"
                value={value}
                disabled={!canUpdate}
                placeholder="Default"
                onChange={(e) => {
                  setDraft(e.target.value)
                  setError(null)
                }}
                aria-invalid={error ? true : undefined}
              />
              <InputGroupAddon align="inline-end">%</InputGroupAddon>
            </InputGroup>
            {error ? <FieldError>{error}</FieldError> : <FieldDescription>Leave empty to use the platform default rate.</FieldDescription>}
          </Field>
          {canUpdate ? (
            <div className="flex gap-2">
              <Button type="submit" disabled={update.isPending || draft === null}>
                {update.isPending ? <Spinner data-icon="inline-start" /> : null}
                Save rate
              </Button>
              {storedText !== "" ? (
                <Button type="button" variant="outline" disabled={update.isPending} onClick={() => void save(null)}>
                  Use platform default
                </Button>
              ) : null}
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  )
}
