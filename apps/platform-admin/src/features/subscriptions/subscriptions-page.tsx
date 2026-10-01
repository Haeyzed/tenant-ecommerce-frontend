"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { useMemo } from "react"

import { KpiStrip } from "@workspace/admin-kit/dashboard"
import { StateView } from "@workspace/admin-kit/states"
import { DataTable, FilterSelect, type DataColumn } from "@workspace/admin-kit/table"
import { formatDate } from "@workspace/format"
import { PageHeader } from "@workspace/ui/components/page-header"

import { INTERVAL_LABELS, ModeBadge, StatusLabel, SUBSCRIPTION_STATUS, labelOf } from "@/features/billing/labels"
import { plansQuery } from "@/features/plans/api"
import { TenantFilter } from "@/features/tenants/tenant-filter"
import { useConsole } from "@/shell/console-context"

import { MODES, SUBSCRIPTION_STATUSES, subscriptionMetricsQuery, subscriptionsQuery, type Subscription } from "./api"

const params = {
  status: parseAsStringLiteral(SUBSCRIPTION_STATUSES),
  mode: parseAsStringLiteral(MODES),
  tenant: parseAsString,
  plan: parseAsInteger,
  page: parseAsInteger.withDefault(1),
  per_page: parseAsInteger.withDefault(25),
}

/** The next date that matters for a subscription: trial end, renewal or end. */
function nextDate(s: Subscription): { label: string; at: string | null } {
  if (s.status === "trialing") return { label: "Trial ends", at: s.trial_ends_at }
  if (s.status === "cancelled") return { label: "Ends", at: s.ends_at }
  return { label: "Renews", at: s.renews_at }
}

/** Every tenant subscription (spec §25.1), filterable by status, mode, tenant and plan. */
export function SubscriptionsPage() {
  const { display } = useConsole()
  const [filters, setFilters] = useQueryStates(params, { clearOnDefault: true, history: "replace" })

  const query = useQuery({
    ...subscriptionsQuery({
      status: filters.status ?? undefined,
      mode: filters.mode ?? undefined,
      tenant: filters.tenant ?? undefined,
      plan_id: filters.plan ?? undefined,
      page: filters.page,
      per_page: filters.per_page,
    }),
    placeholderData: keepPreviousData,
  })
  const metrics = useQuery(subscriptionMetricsQuery(filters.mode ?? "live"))
  const plans = useQuery(plansQuery)

  const columns = useMemo<DataColumn<Subscription>[]>(
    () => [
      {
        id: "tenant",
        header: "Tenant",
        mobile: "title",
        cell: (s) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{s.tenant?.name ?? s.tenant_id}</span>
            {s.tenant ? <span className="truncate text-xs text-muted-foreground">{s.tenant.slug}</span> : null}
          </span>
        ),
      },
      {
        id: "plan",
        header: "Plan",
        mobile: "subtitle",
        cell: (s) => `${s.plan?.name ?? "—"} · ${INTERVAL_LABELS[s.billing_interval] ?? s.billing_interval} · ${s.currency_code}`,
      },
      {
        id: "status",
        header: "Status",
        mobile: "meta",
        cell: (s) => (
          <span className="flex flex-wrap gap-1.5">
            <StatusLabel map={SUBSCRIPTION_STATUS} value={s.status} />
            <ModeBadge mode={s.gateway_mode} />
          </span>
        ),
      },
      {
        id: "next",
        header: "Next date",
        mobile: "detail",
        cell: (s) => {
          const next = nextDate(s)
          return next.at ? (
            <span className="flex flex-col">
              <span className="text-xs text-muted-foreground">{next.label}</span>
              <span className="tabular-nums">{formatDate(next.at, display)}</span>
            </span>
          ) : (
            "—"
          )
        },
      },
      { id: "started", header: "Started", hideable: true, mobile: "hidden", cell: (s) => formatDate(s.starts_at, display) },
      {
        id: "card",
        header: "Card on file",
        hideable: true,
        defaultHidden: true,
        mobile: "hidden",
        cell: (s) => (s.has_payment_method ? "Yes" : "No"),
      },
    ],
    [display]
  )

  const filtered = Boolean(filters.status || filters.mode || filters.tenant || filters.plan)

  return (
    <>
      <PageHeader title="Subscriptions" description="Every store's plan, billing status and next renewal. Test subscriptions are marked." />
      <KpiStrip
        kpis={metrics.data}
        loading={metrics.isPending}
        placeholders={5}
        caption={filters.mode === "test" ? "Figures for test billing." : "Figures for live billing. Choose “Test only” to see test figures."}
      />
      <DataTable<Subscription>
        tableId="subscriptions"
        columns={columns}
        rows={query.data?.items}
        getRowId={(s) => String(s.id)}
        rowHref={(s) => `/subscriptions/${s.id}`}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        filtered={filtered}
        paging={{
          pagination: query.data?.pagination,
          onPageChange: (page) => void setFilters({ page }),
          onPerPageChange: (per_page) => void setFilters({ per_page, page: 1 }),
        }}
        toolbar={
          <>
            <TenantFilter value={filters.tenant} onChange={(tenant) => void setFilters({ tenant, page: 1 })} className="w-full sm:w-60" />
            <FilterSelect
              label="Status"
              anyLabel="Any status"
              value={filters.status}
              options={SUBSCRIPTION_STATUSES.map((s) => ({ value: s, label: labelOf(SUBSCRIPTION_STATUS, s) }))}
              onChange={(status) => void setFilters({ status, page: 1 })}
            />
            <FilterSelect
              label="Plan"
              anyLabel="Any plan"
              value={filters.plan === null ? null : String(filters.plan)}
              options={(plans.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))}
              onChange={(plan) => void setFilters({ plan: plan === null ? null : Number(plan), page: 1 })}
            />
            <FilterSelect
              label="Mode"
              anyLabel="Live and test"
              value={filters.mode}
              options={[
                { value: "live", label: "Live only" },
                { value: "test", label: "Test only" },
              ]}
              onChange={(mode) => void setFilters({ mode, page: 1 })}
              className="sm:w-36"
            />
          </>
        }
        emptyState={<StateView icon="billing" title="No subscriptions yet" description="Stores appear here once they sign up for a plan." />}
        noResultsState={<StateView icon="search" title="No subscriptions match" description="Try another tenant, status, plan or mode." />}
      />
    </>
  )
}
