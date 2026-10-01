"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { parseAsBoolean, parseAsInteger, parseAsStringLiteral, useQueryStates } from "nuqs"
import { useMemo } from "react"

import { useCan } from "@workspace/access/react"
import { KpiStrip } from "@workspace/admin-kit/dashboard"
import { StateView } from "@workspace/admin-kit/states"
import { DataTable, FilterSelect, type DataColumn } from "@workspace/admin-kit/table"
import { formatDate, formatMoney } from "@workspace/format"
import { ButtonLink } from "@workspace/ui/components/button-link"
import { PageHeader } from "@workspace/ui/components/page-header"
import { StatusBadge, type StatusTone } from "@workspace/ui/components/status-badge"
import { Icon } from "@workspace/ui/icons"

import { useConsole } from "@/shell/console-context"

import { COUPON_PERIODS, couponMetricsQuery, couponState, couponsQuery, discountText, type Coupon } from "./api"

export const COUPON_STATE: Record<ReturnType<typeof couponState>, { label: string; tone: StatusTone }> = {
  running: { label: "Running", tone: "success" },
  scheduled: { label: "Scheduled", tone: "info" },
  ended: { label: "Ended", tone: "muted" },
  inactive: { label: "Inactive", tone: "muted" },
}

const params = {
  period: parseAsStringLiteral(COUPON_PERIODS),
  active: parseAsBoolean,
  page: parseAsInteger.withDefault(1),
  per_page: parseAsInteger.withDefault(25),
}

/** Platform coupons for plan subscriptions (spec §25.1, §14.8). */
export function CouponsPage() {
  const { display } = useConsole()
  const [filters, setFilters] = useQueryStates(params, { clearOnDefault: true, history: "replace" })
  const canCreate = useCan("landlord.billing.platform-coupons.store")

  const query = useQuery({
    ...couponsQuery({
      status: filters.period ?? undefined,
      is_active: filters.active ?? undefined,
      page: filters.page,
      per_page: filters.per_page,
    }),
    placeholderData: keepPreviousData,
  })
  const metrics = useQuery(couponMetricsQuery)

  const columns = useMemo<DataColumn<Coupon>[]>(
    () => [
      {
        id: "code",
        header: "Code",
        mobile: "title",
        cell: (c) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-mono font-medium">{c.code}</span>
            <span className="truncate text-xs text-muted-foreground">{c.name}</span>
          </span>
        ),
      },
      { id: "discount", header: "Discount", mobile: "subtitle", cell: (c) => discountText(c, formatMoney) },
      {
        id: "state",
        header: "Status",
        mobile: "meta",
        cell: (c) => {
          const s = COUPON_STATE[couponState(c)]
          return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
        },
      },
      {
        id: "used",
        header: "Redeemed",
        align: "end",
        mobile: "detail",
        cell: (c) => <span className="tabular-nums">{c.usage_limit_total ? `${c.times_redeemed} / ${c.usage_limit_total}` : c.times_redeemed}</span>,
      },
      {
        id: "window",
        header: "Runs",
        hideable: true,
        mobile: "detail",
        cell: (c) => (c.starts_at || c.ends_at ? `${c.starts_at ? formatDate(c.starts_at, display) : "Now"} – ${c.ends_at ? formatDate(c.ends_at, display) : "No end"}` : "Always"),
      },
    ],
    [display]
  )

  const filtered = Boolean(filters.period || filters.active !== null)

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Discount codes stores can use on their plan subscription, at sign-up or when changing plan."
        actions={
          canCreate ? (
            <ButtonLink render={<Link href="/platform-coupons/new" />}>
              <Icon name="add" data-icon="inline-start" />
              New coupon
            </ButtonLink>
          ) : null
        }
      />
      <KpiStrip kpis={metrics.data} loading={metrics.isPending} />
      <DataTable<Coupon>
        tableId="platform-coupons"
        columns={columns}
        rows={query.data?.items}
        getRowId={(c) => String(c.id)}
        rowHref={(c) => `/platform-coupons/${c.id}`}
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
            <FilterSelect
              label="Period"
              anyLabel="Any period"
              value={filters.period}
              options={[
                { value: "running", label: "Running now" },
                { value: "scheduled", label: "Scheduled" },
                { value: "ended", label: "Ended" },
              ]}
              onChange={(period) => void setFilters({ period, page: 1 })}
            />
            <FilterSelect
              label="Switch"
              anyLabel="Active and inactive"
              value={filters.active === null ? null : filters.active ? "yes" : "no"}
              options={[
                { value: "yes", label: "Active only" },
                { value: "no", label: "Inactive only" },
              ]}
              onChange={(v) => void setFilters({ active: v === null ? null : v === "yes", page: 1 })}
            />
          </>
        }
        emptyState={<StateView icon="discount" title="No coupons yet" description="Create a coupon to offer stores a discount on their plan." />}
        noResultsState={<StateView icon="search" title="No coupons match" description="Try another period or switch." />}
      />
    </>
  )
}
