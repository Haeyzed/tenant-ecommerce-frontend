"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { useMemo } from "react"

import { KpiStrip } from "@workspace/admin-kit/dashboard"
import { StateView } from "@workspace/admin-kit/states"
import { DataTable, FilterSelect, type DataColumn } from "@workspace/admin-kit/table"
import { formatDateTime, formatMoney } from "@workspace/format"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { PageHeader } from "@workspace/ui/components/page-header"

import { ModeBadge, PROVIDER_LABELS, StatusLabel, TRANSACTION_STATUS, TRANSACTION_TYPE, labelOf } from "@/features/billing/labels"
import { MODES } from "@/features/subscriptions/api"
import { TenantFilter } from "@/features/tenants/tenant-filter"
import { useConsole } from "@/shell/console-context"

import { PROVIDERS, TRANSACTION_STATUSES, TRANSACTION_TYPES, transactionMetricsQuery, transactionsQuery, type Transaction } from "./api"

const YMD = /^\d{4}-\d{2}-\d{2}$/

const params = {
  type: parseAsStringLiteral(TRANSACTION_TYPES),
  status: parseAsStringLiteral(TRANSACTION_STATUSES),
  mode: parseAsStringLiteral(MODES),
  provider: parseAsStringLiteral(PROVIDERS),
  tenant: parseAsString,
  from: parseAsString,
  to: parseAsString,
  page: parseAsInteger.withDefault(1),
  per_page: parseAsInteger.withDefault(25),
}

/** Every platform charge, refund and chargeback (spec §25.1). */
export function TransactionsPage() {
  const { display } = useConsole()
  const [filters, setFilters] = useQueryStates(params, { clearOnDefault: true, history: "replace" })
  const from = filters.from && YMD.test(filters.from) ? filters.from : null
  const to = filters.to && YMD.test(filters.to) ? filters.to : null

  const query = useQuery({
    ...transactionsQuery({
      type: filters.type ?? undefined,
      status: filters.status ?? undefined,
      mode: filters.mode ?? undefined,
      provider: filters.provider ?? undefined,
      tenant: filters.tenant ?? undefined,
      from: from ?? undefined,
      // "To" is a whole day: include everything up to its end.
      to: to ? `${to} 23:59:59` : undefined,
      page: filters.page,
      per_page: filters.per_page,
    }),
    placeholderData: keepPreviousData,
  })
  const metrics = useQuery(transactionMetricsQuery(filters.mode ?? "live"))

  const columns = useMemo<DataColumn<Transaction>[]>(
    () => [
      {
        id: "tenant",
        header: "Tenant",
        mobile: "title",
        cell: (t) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{t.tenant?.name ?? t.tenant_id}</span>
            <span className="truncate font-mono text-xs text-muted-foreground">{t.reference}</span>
          </span>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        align: "end",
        mobile: "subtitle",
        cell: (t) => <span className="font-medium tabular-nums">{formatMoney(t.amount, t.currency_code)}</span>,
      },
      {
        id: "type",
        header: "Type",
        mobile: "detail",
        cell: (t) => `${TRANSACTION_TYPE[t.type] ?? t.type} · ${PROVIDER_LABELS[t.provider] ?? t.provider}`,
      },
      {
        id: "status",
        header: "Status",
        mobile: "meta",
        cell: (t) => (
          <span className="flex flex-wrap gap-1.5">
            <StatusLabel map={TRANSACTION_STATUS} value={t.status} />
            <ModeBadge mode={t.mode} />
          </span>
        ),
      },
      { id: "date", header: "Date", mobile: "detail", cell: (t) => <span className="tabular-nums">{formatDateTime(t.paid_at ?? t.created_at, display)}</span> },
      { id: "fee", header: "Fee", align: "end", hideable: true, defaultHidden: true, mobile: "hidden", cell: (t) => (t.fee ? formatMoney(t.fee, t.currency_code) : "—") },
    ],
    [display]
  )

  const filtered = Boolean(filters.type || filters.status || filters.mode || filters.provider || filters.tenant || from || to)

  return (
    <>
      <PageHeader title="Payment transactions" description="Subscription charges, refunds and chargebacks across every gateway. Test transactions are marked." />
      <KpiStrip
        kpis={metrics.data}
        loading={metrics.isPending}
        caption={filters.mode === "test" ? "Figures for test billing." : "Figures for live billing. Choose “Test only” to see test figures."}
      />
      <DataTable<Transaction>
        tableId="payment-transactions"
        columns={columns}
        rows={query.data?.items}
        getRowId={(t) => String(t.id)}
        rowHref={(t) => `/payment-transactions/${t.id}`}
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
              label="Type"
              anyLabel="Any type"
              value={filters.type}
              options={TRANSACTION_TYPES.map((t) => ({ value: t, label: TRANSACTION_TYPE[t] ?? t }))}
              onChange={(type) => void setFilters({ type, page: 1 })}
              className="sm:w-36"
            />
            <FilterSelect
              label="Status"
              anyLabel="Any status"
              value={filters.status}
              options={TRANSACTION_STATUSES.map((s) => ({ value: s, label: labelOf(TRANSACTION_STATUS, s) }))}
              onChange={(status) => void setFilters({ status, page: 1 })}
              className="sm:w-36"
            />
            <FilterSelect
              label="Gateway"
              anyLabel="Any gateway"
              value={filters.provider}
              options={PROVIDERS.map((p) => ({ value: p, label: PROVIDER_LABELS[p] ?? p }))}
              onChange={(provider) => void setFilters({ provider, page: 1 })}
              className="sm:w-36"
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
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Label htmlFor="tx-from" className="sr-only">
                From
              </Label>
              <Input id="tx-from" type="date" value={from ?? ""} max={to ?? undefined} onChange={(e) => void setFilters({ from: e.target.value || null, page: 1 })} className="w-full sm:w-40" />
              <span className="text-muted-foreground">–</span>
              <Label htmlFor="tx-to" className="sr-only">
                To
              </Label>
              <Input id="tx-to" type="date" value={to ?? ""} min={from ?? undefined} onChange={(e) => void setFilters({ to: e.target.value || null, page: 1 })} className="w-full sm:w-40" />
            </div>
          </>
        }
        emptyState={<StateView icon="money" title="No transactions yet" description="Charges appear here when stores pay for their plans." />}
        noResultsState={<StateView icon="search" title="No transactions match" description="Try another tenant, type, status, gateway or date." />}
      />
    </>
  )
}
