"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { useEffect, useMemo, useState } from "react"

import { KpiStrip } from "@workspace/admin-kit/dashboard"
import { StaticCombobox } from "@workspace/admin-kit/lookup"
import { StateView } from "@workspace/admin-kit/states"
import { DataTable, FilterSelect, type DataColumn } from "@workspace/admin-kit/table"
import { formatDate } from "@workspace/format"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group"
import { Label } from "@workspace/ui/components/label"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Icon } from "@workspace/ui/icons"

import { StatusLabel, labelOf } from "@/features/billing/labels"
import { useLookup } from "@/features/lookups"
import { plansQuery } from "@/features/plans/api"
import { useConsole } from "@/shell/console-context"

import { TENANT_STATUSES, tenantMetricsQuery, tenantsQuery, type Tenant } from "./api"
import { TENANT_STATUS } from "./labels"

const params = {
  search: parseAsString.withDefault(""),
  status: parseAsStringLiteral(TENANT_STATUSES),
  plan: parseAsString,
  country: parseAsInteger,
  page: parseAsInteger.withDefault(1),
  per_page: parseAsInteger.withDefault(25),
}

/** Every store on the platform (spec §25.1), searchable by name, email or slug. */
export function TenantsPage() {
  const { display } = useConsole()
  const [filters, setFilters] = useQueryStates(params, { clearOnDefault: true, history: "replace" })
  const [search, setSearch] = useState(filters.search)
  const plans = useQuery(plansQuery)
  const countries = useLookup("countries")
  const metrics = useQuery(tenantMetricsQuery)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== filters.search) void setFilters({ search, page: 1 })
    }, 300)
    return () => clearTimeout(timer)
  }, [search, filters.search, setFilters])

  const query = useQuery({
    ...tenantsQuery({
      search: filters.search || undefined,
      status: filters.status ?? undefined,
      plan: filters.plan ?? undefined,
      country: filters.country ?? undefined,
      page: filters.page,
      per_page: filters.per_page,
    }),
    placeholderData: keepPreviousData,
  })

  const countryName = useMemo(() => new Map((countries.data ?? []).map((c) => [Number(c.value), c.label])), [countries.data])

  const columns = useMemo<DataColumn<Tenant>[]>(
    () => [
      {
        id: "store",
        header: "Store",
        mobile: "title",
        cell: (t) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{t.name}</span>
            <span className="truncate text-xs text-muted-foreground">{t.domains?.find((d) => d.is_primary)?.domain ?? t.slug}</span>
          </span>
        ),
      },
      {
        id: "owner",
        header: "Owner",
        mobile: "subtitle",
        cell: (t) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{t.owner_name}</span>
            <span className="truncate text-xs text-muted-foreground">{t.email}</span>
          </span>
        ),
      },
      { id: "status", header: "Status", mobile: "meta", cell: (t) => <StatusLabel map={TENANT_STATUS} value={t.status} /> },
      { id: "country", header: "Country", hideable: true, mobile: "detail", cell: (t) => `${countryName.get(t.country_id) ?? "—"} · ${t.default_currency}` },
      { id: "created", header: "Signed up", hideable: true, mobile: "detail", cell: (t) => formatDate(t.created_at, display) },
    ],
    [display, countryName]
  )

  const filtered = Boolean(filters.search || filters.status || filters.plan || filters.country)

  return (
    <>
      <PageHeader title="Tenants" description="Every store on the platform: its status, owner and plan. Open a store to manage its subscription, modules and limits." />
      <KpiStrip kpis={metrics.data} loading={metrics.isPending} />
      <DataTable<Tenant>
        tableId="tenants"
        columns={columns}
        rows={query.data?.items}
        getRowId={(t) => t.id}
        rowHref={(t) => `/tenants/${encodeURIComponent(t.id)}`}
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
              <InputGroupInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email or slug" aria-label="Search tenants" />
            </InputGroup>
            <FilterSelect
              label="Status"
              anyLabel="Any status"
              value={filters.status}
              options={TENANT_STATUSES.map((s) => ({ value: s, label: labelOf(TENANT_STATUS, s) }))}
              onChange={(status) => void setFilters({ status, page: 1 })}
            />
            <FilterSelect
              label="Plan"
              anyLabel="Any plan"
              value={filters.plan}
              options={(plans.data ?? []).map((p) => ({ value: p.slug, label: p.name }))}
              onChange={(plan) => void setFilters({ plan, page: 1 })}
            />
            <div className="w-full sm:w-48">
              <Label htmlFor="tenant-country" className="sr-only">
                Country
              </Label>
              <StaticCombobox
                id="tenant-country"
                options={countries.data ?? []}
                loading={countries.isPending}
                value={filters.country === null ? null : String(filters.country)}
                onChange={(country) => void setFilters({ country: country === null ? null : Number(country), page: 1 })}
                placeholder="Any country"
                clearable
              />
            </div>
          </>
        }
        emptyState={<StateView icon="store" title="No stores yet" description="Stores appear here when they sign up on the website." />}
        noResultsState={<StateView icon="search" title="No stores match" description="Try another search, status, plan or country." />}
      />
    </>
  )
}
