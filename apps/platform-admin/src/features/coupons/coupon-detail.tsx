"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useState } from "react"

import { useCan } from "@workspace/access/react"
import type { operations } from "@workspace/contract/landlord"
import { ErrorState, StateView } from "@workspace/admin-kit/states"
import { DataTable, type DataColumn } from "@workspace/admin-kit/table"
import { formatDateTime, formatMoney, formatNumber } from "@workspace/format"
import { Button } from "@workspace/ui/components/button"
import { ButtonLink } from "@workspace/ui/components/button-link"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { StatCard } from "@workspace/ui/components/stat-card"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import { toast } from "@workspace/ui/components/toast"
import { Icon } from "@workspace/ui/icons"

import { DetailCard } from "@/features/billing/details"
import { REDEMPTION_STATUS, StatusLabel } from "@/features/billing/labels"
import { plansQuery } from "@/features/plans/api"
import { useConsole } from "@/shell/console-context"

import { couponQuery, couponState, discountText, redemptionsQuery, useDeactivateCoupon } from "./api"
import { COUPON_STATE } from "./coupons-page"

type Redemption = operations["landlord.billing.platform-coupons.redemptions.index"]["responses"][200]["content"]["application/json"]["data"][number]

/** One coupon (spec §25.1): its terms, usage and every redemption. */
export function CouponDetail({ id }: { id: number }) {
  const { display } = useConsole()
  const query = useQuery(couponQuery(id))
  const plans = useQuery(plansQuery)
  const [page, setPage] = useState(1)
  const redemptions = useQuery({ ...redemptionsQuery(id, page), placeholderData: keepPreviousData })
  const [confirm, setConfirm] = useState(false)
  const deactivate = useDeactivateCoupon(id)
  const canEdit = useCan("landlord.billing.platform-coupons.update")
  const canDeactivate = useCan("landlord.billing.platform-coupons.deactivate")

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} size="page" />

  const { coupon: c, usage } = query.data
  const state = COUPON_STATE[couponState(c)]
  const planNames = (c.targets ?? [])
    .filter((t) => t.target_type === "plan")
    .map((t) => plans.data?.find((p) => p.id === t.target_id)?.name ?? `Plan #${t.target_id}`)
  const priceTargets = (c.targets ?? []).filter((t) => t.target_type === "plan_price").length

  async function runDeactivate() {
    try {
      await deactivate.mutateAsync()
      toast.add({ title: `${c.code} deactivated`, type: "success" })
      setConfirm(false)
    } catch {
      toast.add({ title: "Couldn't deactivate the coupon", type: "error" })
    }
  }

  const columns: DataColumn<Redemption>[] = [
    {
      id: "tenant",
      header: "Store",
      mobile: "title",
      cell: (r) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{r.tenant_name ?? r.tenant_id}</span>
          <span className="truncate text-xs text-muted-foreground">{r.owner_email}</span>
        </span>
      ),
    },
    { id: "status", header: "Status", mobile: "meta", cell: (r) => <StatusLabel map={REDEMPTION_STATUS} value={r.status} /> },
    { id: "cycles", header: "Payments", align: "end", mobile: "detail", cell: (r) => <span className="tabular-nums">{r.cycles_total ? `${r.cycles_applied} / ${r.cycles_total}` : r.cycles_applied}</span> },
    { id: "saved", header: "Discount given", align: "end", mobile: "subtitle", cell: (r) => <span className="tabular-nums">{Number(r.total_discount_amount) > 0 ? formatNumber(r.total_discount_amount) : "—"}</span> },
    { id: "date", header: "Used", mobile: "detail", cell: (r) => formatDateTime(r.activated_at ?? r.reserved_at, display) },
  ]

  return (
    <>
      <PageHeader
        title={<span className="font-mono">{c.code}</span>}
        description={c.name}
        meta={<StatusBadge tone={state.tone}>{state.label}</StatusBadge>}
        actions={
          <>
            {canEdit ? (
              <ButtonLink variant="outline" render={<Link href={`/platform-coupons/${c.id}/edit`} />}>
                <Icon name="edit" data-icon="inline-start" />
                Edit
              </ButtonLink>
            ) : null}
            {canDeactivate && c.is_active ? (
              <Button variant="outline" className="text-destructive" onClick={() => setConfirm(true)}>
                Deactivate
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Redeemed" value={String(usage.times_redeemed)} supportingLabel={usage.remaining === null ? "No limit" : `${usage.remaining} left`} />
        <StatCard label="Active" value={String(usage.by_status.active ?? 0)} supportingLabel="Still discounting" />
        <StatCard label="Completed" value={String(usage.by_status.completed ?? 0)} supportingLabel="All discounted payments used" />
        <StatCard label="Discount given" value={Number(usage.total_discount_amount) > 0 ? formatNumber(usage.total_discount_amount) : "None"} supportingLabel="Sum across currencies" />
      </div>

      <DetailCard
        title="Terms"
        details={[
          { term: "Discount", value: discountText(c, formatMoney) },
          { term: "Maximum discount", value: c.max_discount_amount ? c.max_discount_amount : null },
          { term: "Plans", value: planNames.length > 0 ? planNames.join(", ") : priceTargets > 0 ? null : "Every plan" },
          { term: "Specific prices", value: priceTargets > 0 ? `${priceTargets} price(s)` : null },
          { term: "Minimum plan price", value: c.min_amount },
          { term: "New stores only", value: c.first_subscription_only ? "Yes" : "No" },
          { term: "Total limit", value: c.usage_limit_total ? String(c.usage_limit_total) : "No limit" },
          { term: "Per store", value: String(c.usage_limit_per_tenant) },
          { term: "Starts", value: c.starts_at ? formatDateTime(c.starts_at, display) : "Immediately" },
          { term: "Ends", value: c.ends_at ? formatDateTime(c.ends_at, display) : "No end date" },
          { term: "Description", value: c.description, wide: true },
        ]}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Redemptions</h2>
        <DataTable<Redemption>
          tableId="coupon-redemptions"
          columns={columns}
          rows={redemptions.data?.items}
          getRowId={(r) => String(r.id)}
          isLoading={redemptions.isPending}
          isFetching={redemptions.isFetching}
          error={redemptions.error}
          onRetry={() => void redemptions.refetch()}
          filtered={false}
          paging={{ pagination: redemptions.data?.pagination, onPageChange: setPage, onPerPageChange: () => setPage(1) }}
          emptyState={<StateView icon="discount" title="Not used yet" description="Stores that apply this code appear here." />}
          noResultsState={<StateView icon="search" title="No redemptions" description="" />}
        />
      </section>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Deactivate ${c.code}?`}
        description="Stores can no longer apply it. Discounts already granted continue for their remaining payments."
        confirmLabel="Deactivate"
        destructive
        pending={deactivate.isPending}
        onConfirm={() => void runDeactivate()}
      />
    </>
  )
}
