"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { parseAsBoolean, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { useEffect, useMemo, useState } from "react"

import { KpiStrip } from "@workspace/admin-kit/dashboard"
import { StateView } from "@workspace/admin-kit/states"
import { DataTable, FilterSelect, type DataColumn } from "@workspace/admin-kit/table"
import { formatDate, formatPercent } from "@workspace/format"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Icon } from "@workspace/ui/icons"

import { StatusLabel, labelOf } from "@/features/billing/labels"
import { useConsole } from "@/shell/console-context"

import { affiliateMetricsQuery, affiliatesQuery, type Affiliate } from "./api"
import { AFFILIATE_STATUS, AFFILIATE_STATUSES } from "./labels"

const params = {
  search: parseAsString.withDefault(""),
  status: parseAsStringLiteral(AFFILIATE_STATUSES),
  flagged: parseAsBoolean.withDefault(false),
  page: parseAsInteger.withDefault(1),
  per_page: parseAsInteger.withDefault(25),
}

/** Affiliates and their applications (spec §25.1, §21A.10). */
export function AffiliatesPage() {
  const { display } = useConsole()
  const [filters, setFilters] = useQueryStates(params, { clearOnDefault: true, history: "replace" })
  const [search, setSearch] = useState(filters.search)
  const metrics = useQuery(affiliateMetricsQuery)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== filters.search) void setFilters({ search, page: 1 })
    }, 300)
    return () => clearTimeout(timer)
  }, [search, filters.search, setFilters])

  const query = useQuery({
    ...affiliatesQuery({
      search: filters.search || undefined,
      status: filters.status ?? undefined,
      has_flags: filters.flagged || undefined,
      page: filters.page,
      per_page: filters.per_page,
    }),
    placeholderData: keepPreviousData,
  })

  const columns = useMemo<DataColumn<Affiliate>[]>(
    () => [
      {
        id: "affiliate",
        header: "Affiliate",
        mobile: "title",
        cell: (a) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{a.name}</span>
            <span className="truncate text-xs text-muted-foreground">{a.email}</span>
          </span>
        ),
      },
      {
        id: "code",
        header: "Code",
        mobile: "subtitle",
        cell: (a) => (a.referral_code ? <span className="font-mono text-xs">{a.referral_code}</span> : <span className="text-muted-foreground">—</span>),
      },
      { id: "status", header: "Status", mobile: "meta", cell: (a) => <StatusLabel map={AFFILIATE_STATUS} value={a.status} /> },
      {
        id: "rate",
        header: "Commission",
        align: "end",
        mobile: "detail",
        cell: (a) => (
          <span className="tabular-nums">
            {formatPercent(a.effective_commission_rate)}
            {a.commission_rate !== null && a.commission_rate !== undefined ? <span className="text-xs text-muted-foreground"> (custom)</span> : null}
          </span>
        ),
      },
      { id: "company", header: "Company", hideable: true, mobile: "detail", cell: (a) => a.company_name ?? "—" },
      { id: "joined", header: "Applied", mobile: "detail", cell: (a) => formatDate(a.created_at, display) },
    ],
    [display]
  )

  const filtered = Boolean(filters.search || filters.status || filters.flagged)

  return (
    <>
      <PageHeader title="Affiliates" description="People who refer stores for a commission. Review applications, set rates and manage their status." />
      <KpiStrip kpis={metrics.data} loading={metrics.isPending} placeholders={4} />
      <DataTable<Affiliate>
        tableId="affiliates"
        columns={columns}
        rows={query.data?.items}
        getRowId={(a) => a.public_id}
        rowHref={(a) => (a.id === undefined ? "/affiliates" : `/affiliates/${a.id}`)}
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
            <InputGroup className="w-full sm:w-64">
              <InputGroupAddon>
                <Icon name="search" />
              </InputGroupAddon>
              <InputGroupInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email or code" aria-label="Search affiliates" />
            </InputGroup>
            <FilterSelect
              label="Status"
              anyLabel="Any status"
              value={filters.status}
              options={AFFILIATE_STATUSES.map((s) => ({ value: s, label: labelOf(AFFILIATE_STATUS, s) }))}
              onChange={(status) => void setFilters({ status, page: 1 })}
            />
            <FilterSelect
              label="Review"
              anyLabel="Any"
              value={filters.flagged ? "flagged" : null}
              options={[{ value: "flagged", label: "Referrals to review" }]}
              onChange={(v) => void setFilters({ flagged: v === "flagged", page: 1 })}
            />
          </>
        }
        emptyState={
          <StateView icon="customers" title="No affiliates yet" description="Applications from the affiliate portal appear here for review." />
        }
        noResultsState={<StateView icon="search" title="No affiliates match" description="Try another name, status or review filter." />}
      />
    </>
  )
}
