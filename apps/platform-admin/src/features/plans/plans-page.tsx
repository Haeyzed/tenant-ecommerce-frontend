"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useMemo } from "react"

import { useCan } from "@workspace/access/react"
import { StateView } from "@workspace/admin-kit/states"
import { DataTable, type DataColumn } from "@workspace/admin-kit/table"
import { formatMoney } from "@workspace/format"
import { Badge } from "@workspace/ui/components/badge"
import { ButtonLink } from "@workspace/ui/components/button-link"
import { PageHeader } from "@workspace/ui/components/page-header"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import { Icon } from "@workspace/ui/icons"

import { plansQuery, type Plan } from "./api"

const SHORT_INTERVAL = { monthly: "mo", yearly: "yr" } as const

/** Subscription plans (spec §25.1): every plan, active or not, in display order. */
export function PlansPage() {
  const query = useQuery(plansQuery)
  const canCreate = useCan("landlord.plans.store")

  const columns = useMemo<DataColumn<Plan>[]>(
    () => [
      {
        id: "plan",
        header: "Plan",
        mobile: "title",
        cell: (p) => (
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-2 truncate font-medium">
              {p.name}
              {p.recommended ? <Badge variant="secondary">{p.badge ?? "Recommended"}</Badge> : null}
            </span>
            <span className="truncate text-xs text-muted-foreground">{p.tagline ?? p.slug}</span>
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        mobile: "meta",
        cell: (p) => (
          <span className="flex flex-wrap gap-1.5">
            <StatusBadge tone={p.active ? "success" : "muted"}>{p.active ? "Active" : "Inactive"}</StatusBadge>
            {p.active && !p.public ? <StatusBadge tone="neutral">Hidden</StatusBadge> : null}
          </span>
        ),
      },
      {
        id: "prices",
        header: "Prices",
        mobile: "subtitle",
        cell: (p) => {
          const active = p.prices.filter((price) => price.active)
          if (active.length === 0) return <span className="text-warning">No active price</span>
          return (
            <span className="flex flex-col text-sm">
              {active.slice(0, 3).map((price) => (
                <span key={price.id}>
                  <span className="tabular-nums">{formatMoney(price.amount, price.currency)}</span> / {SHORT_INTERVAL[price.interval]}
                  {price.resolvedTrialDays > 0 ? <span className="text-muted-foreground"> · {price.resolvedTrialDays}-day trial</span> : null}
                </span>
              ))}
              {active.length > 3 ? <span className="text-xs text-muted-foreground">and {active.length - 3} more</span> : null}
            </span>
          )
        },
      },
      { id: "features", header: "Features", mobile: "detail", align: "end", cell: (p) => <span className="tabular-nums">{p.features.length}</span> },
      { id: "order", header: "Order", hideable: true, mobile: "hidden", align: "end", cell: (p) => <span className="tabular-nums">{p.sortOrder}</span> },
    ],
    []
  )

  return (
    <>
      <PageHeader
        title="Plans"
        description="What stores can subscribe to: prices per currency and interval, included features and usage limits."
        actions={
          canCreate ? (
            <ButtonLink render={<Link href="/plans/new" />}>
              <Icon name="add" data-icon="inline-start" />
              New plan
            </ButtonLink>
          ) : null
        }
      />
      <DataTable<Plan>
        tableId="plans"
        columns={columns}
        rows={query.data}
        getRowId={(p) => String(p.id)}
        rowHref={(p) => `/plans/${p.id}`}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        filtered={false}
        emptyState={<StateView icon="billing" title="No plans yet" description="Create a plan so stores can sign up." />}
        noResultsState={<StateView icon="search" title="No plans match" description="Try another filter." />}
      />
    </>
  )
}
