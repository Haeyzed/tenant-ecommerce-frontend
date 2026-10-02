"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { useMemo, useState } from "react"

import { useCan } from "@workspace/access/react"
import { StateView } from "@workspace/admin-kit/states"
import { DataTable, FilterSelect, type DataColumn } from "@workspace/admin-kit/table"
import { isApiError } from "@workspace/api-client"
import { formatDate, formatMoney } from "@workspace/format"
import { Button } from "@workspace/ui/components/button"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/components/toast"
import { Icon } from "@workspace/ui/icons"

import { StatusLabel, labelOf } from "@/features/billing/labels"
import { useLookup } from "@/features/lookups"
import { useConsole } from "@/shell/console-context"

import { AffiliateFilter } from "./affiliate-filter"
import { payoutsQuery, useGeneratePayouts, type Payout } from "./api"
import { PAYOUT_METHOD, PAYOUT_STATUS, PAYOUT_STATUSES, textOf } from "./labels"

/** Payouts: approved commissions grouped per affiliate and currency for one period (spec §21A.7). */
export function PayoutsTable({ affiliateId }: { affiliateId?: number }) {
  const { display } = useConsole()
  const [filters, setFilters] = useQueryStates(
    {
      pstatus: parseAsStringLiteral(PAYOUT_STATUSES),
      pcurrency: parseAsString,
      affiliate: parseAsInteger,
      ppage: parseAsInteger.withDefault(1),
      pper_page: parseAsInteger.withDefault(25),
    },
    { clearOnDefault: true, history: "replace" }
  )
  const currencies = useLookup("currencies")

  const query = useQuery({
    ...payoutsQuery({
      status: filters.pstatus ?? undefined,
      currency_code: filters.pcurrency ?? undefined,
      affiliate_id: affiliateId ?? filters.affiliate ?? undefined,
      page: filters.ppage,
      per_page: filters.pper_page,
    }),
    placeholderData: keepPreviousData,
  })

  const columns = useMemo<DataColumn<Payout>[]>(
    () => [
      {
        id: "payout",
        header: "Payout",
        mobile: "title",
        cell: (p) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-mono text-xs font-medium">{p.reference}</span>
            {affiliateId === undefined && p.affiliate ? <span className="truncate text-xs text-muted-foreground">{p.affiliate.name}</span> : null}
          </span>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        align: "end",
        mobile: "subtitle",
        cell: (p) => <span className="font-medium tabular-nums">{formatMoney(p.amount, p.currency_code)}</span>,
      },
      { id: "status", header: "Status", mobile: "meta", cell: (p) => <StatusLabel map={PAYOUT_STATUS} value={p.status} /> },
      {
        id: "period",
        header: "Period",
        mobile: "detail",
        cell: (p) => `${formatDate(p.period_start, display)} – ${formatDate(p.period_end, display)}`,
      },
      { id: "count", header: "Commissions", align: "end", mobile: "detail", cell: (p) => <span className="tabular-nums">{p.commission_count}</span> },
      { id: "method", header: "Method", mobile: "detail", cell: (p) => textOf(PAYOUT_METHOD, p.payout_method) },
      { id: "paid", header: "Paid", hideable: true, mobile: "detail", cell: (p) => (p.paid_at ? formatDate(p.paid_at, display) : "—") },
    ],
    [affiliateId, display]
  )

  return (
    <DataTable<Payout>
      tableId={affiliateId === undefined ? "affiliate-payouts" : "affiliate-detail-payouts"}
      columns={columns}
      rows={query.data?.items}
      getRowId={(p) => p.reference}
      rowHref={(p) => (p.id === undefined ? "/affiliate-payouts" : `/affiliate-payouts/${p.id}`)}
      isLoading={query.isPending}
      isFetching={query.isFetching}
      error={query.error}
      onRetry={() => void query.refetch()}
      filtered={Boolean(filters.pstatus || filters.pcurrency || (affiliateId === undefined && filters.affiliate))}
      paging={{
        pagination: query.data?.pagination,
        onPageChange: (ppage) => void setFilters({ ppage }),
        onPerPageChange: (pper_page) => void setFilters({ pper_page, ppage: 1 }),
      }}
      toolbar={
        <>
          {affiliateId === undefined ? (
            <AffiliateFilter value={filters.affiliate} onChange={(a) => void setFilters({ affiliate: a, ppage: 1 })} className="w-full sm:w-60" />
          ) : null}
          <FilterSelect
            label="Status"
            anyLabel="Any status"
            value={filters.pstatus}
            options={PAYOUT_STATUSES.map((s) => ({ value: s, label: labelOf(PAYOUT_STATUS, s) }))}
            onChange={(pstatus) => void setFilters({ pstatus, ppage: 1 })}
          />
          <FilterSelect
            label="Currency"
            anyLabel="Any currency"
            value={filters.pcurrency}
            options={(currencies.data ?? []).map((c) => ({ value: c.value, label: c.value }))}
            onChange={(pcurrency) => void setFilters({ pcurrency, ppage: 1 })}
            className="sm:w-36"
          />
        </>
      }
      emptyState={<StateView icon="wallet" title="No payouts yet" description="Generate payouts at the end of a period to pay approved commissions." />}
      noResultsState={<StateView icon="search" title="No payouts match" description="Try another status, currency or affiliate." />}
    />
  )
}

/** Local date as YYYY-MM-DD, for the date input's default and maximum. */
function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Creates the pending payouts for a period ending on the chosen date. */
export function GeneratePayoutsButton() {
  const canGenerate = useCan("landlord.affiliates.admin.payouts.generate")
  const generate = useGeneratePayouts()
  const [open, setOpen] = useState(false)
  const [max] = useState(today)
  const [periodEnd, setPeriodEnd] = useState(max)
  const [error, setError] = useState<string | null>(null)

  if (!canGenerate) return null

  async function confirm() {
    if (!periodEnd || periodEnd > max) {
      setError("Choose today or an earlier date.")
      return
    }
    try {
      const created = await generate.mutateAsync(periodEnd)
      toast.add({
        title: created.length === 0 ? "No payouts were due" : `${created.length} payout${created.length === 1 ? "" : "s"} created`,
        description:
          created.length === 0
            ? "No affiliate had approved commissions above the minimum with payout details in place."
            : "Pay each one by bank or PayPal, then mark it paid with the transfer reference.",
        type: created.length === 0 ? "info" : "success",
      })
      setOpen(false)
    } catch (e) {
      setError(isApiError(e) ? (e.fieldErrors.period_end?.[0] ?? e.message) : "Couldn't generate payouts. Try again.")
    }
  }

  return (
    <>
      <Button
        onClick={() => {
          setPeriodEnd(max)
          setError(null)
          setOpen(true)
        }}
      >
        <Icon name="add" data-icon="inline-start" />
        Generate payouts
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Generate payouts"
        description={
          <>
            Creates one payout per affiliate and currency from commissions approved up to the end of this date. Balances below the minimum payout roll
            over, and affiliates who changed their payout details very recently wait until the next run. A currency with no minimum set in Settings is
            never paid out.
          </>
        }
        confirmLabel="Generate"
        pending={generate.isPending}
        onConfirm={() => void confirm()}
      >
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="period-end">Period ends on</FieldLabel>
          <Input
            id="period-end"
            type="date"
            max={max}
            value={periodEnd}
            onChange={(e) => {
              setPeriodEnd(e.target.value)
              setError(null)
            }}
            className="w-48"
            aria-invalid={error ? true : undefined}
          />
          {error ? <FieldError>{error}</FieldError> : <FieldDescription>In the platform&apos;s time zone.</FieldDescription>}
        </Field>
      </ConfirmDialog>
    </>
  )
}

export function AffiliateLink({ payout }: { payout: Payout }) {
  return payout.affiliate ? (
    <Link href={`/affiliates/${payout.affiliate.id}`} className="underline underline-offset-4">
      {payout.affiliate.name}
    </Link>
  ) : (
    <>—</>
  )
}
