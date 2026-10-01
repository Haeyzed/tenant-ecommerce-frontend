"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { useEffect, useMemo, useState } from "react"

import { StateView } from "@workspace/admin-kit/states"
import { DataTable, FilterSelect, type DataColumn } from "@workspace/admin-kit/table"
import { unwrapPage } from "@workspace/api-client"
import type { operations } from "@workspace/contract/landlord"
import { formatDateTime } from "@workspace/format"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group"
import { PageHeader } from "@workspace/ui/components/page-header"
import { StatusBadge, type StatusTone } from "@workspace/ui/components/status-badge"
import { Icon } from "@workspace/ui/icons"

import { api } from "@/shell/api-client"
import { useConsole } from "@/shell/console-context"

export { registrationsNav } from "./nav"

const STATUSES = ["pending_verification", "converted", "expired"] as const
const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  pending_verification: { label: "Awaiting verification", tone: "neutral" },
  converted: { label: "Verified", tone: "success" },
  expired: { label: "Expired", tone: "muted" },
}

const params = {
  status: parseAsStringLiteral(STATUSES),
  email: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
  per_page: parseAsInteger.withDefault(25),
}

/** @source App\Modules\Tenancy\Http\Controllers\Landlord\Admin\TenantRegistrationController */
type Registration = operations["landlord.tenancy.registrations.index"]["responses"][200]["content"]["application/json"]["data"][number]

/** Self-service sign-ups (spec §25.1): read-only, filterable by status and email. */
export function RegistrationsPage() {
  const { display } = useConsole()
  const [filters, setFilters] = useQueryStates(params, { clearOnDefault: true, history: "replace" })
  const [email, setEmail] = useState(filters.email)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (email !== filters.email) void setFilters({ email, page: 1 })
    }, 300)
    return () => clearTimeout(timer)
  }, [email, filters.email, setFilters])

  const query = useQuery({
    queryKey: ["tenant-registrations", "list", filters],
    queryFn: ({ signal }) =>
      unwrapPage(
        api.GET("/admin/tenant-registrations", {
          params: {
            query: {
              status: filters.status ?? undefined,
              email: filters.email || undefined,
              page: filters.page,
              per_page: filters.per_page,
            },
          },
          signal,
        })
      ),
    placeholderData: keepPreviousData,
  })

  const columns = useMemo<DataColumn<Registration>[]>(
    () => [
      {
        id: "business",
        header: "Business",
        mobile: "title",
        cell: (r) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{r.business_name}</span>
            <span className="truncate text-xs text-muted-foreground">{r.slug}</span>
          </span>
        ),
      },
      {
        id: "owner",
        header: "Owner",
        mobile: "subtitle",
        cell: (r) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{r.owner_name}</span>
            <span className="truncate text-xs text-muted-foreground">{r.email}</span>
          </span>
        ),
      },
      { id: "plan", header: "Plan", mobile: "detail", cell: (r) => <span className="capitalize">{`${r.plan} · ${r.billing_interval}`}</span> },
      {
        id: "status",
        header: "Status",
        mobile: "meta",
        cell: (r) => {
          const s = STATUS[r.status] ?? { label: r.status, tone: "neutral" as const }
          return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
        },
      },
      { id: "created", header: "Signed up", hideable: true, mobile: "detail", cell: (r) => formatDateTime(r.created_at, display) },
      { id: "verified", header: "Verified", hideable: true, defaultHidden: true, mobile: "hidden", cell: (r) => formatDateTime(r.verified_at, display) },
    ],
    [display]
  )

  const filtered = Boolean(filters.status || filters.email)

  return (
    <>
      <PageHeader title="Registrations" description="Every self-service sign-up, from email verification to a provisioned store." />
      <DataTable<Registration>
        tableId="tenant-registrations"
        columns={columns}
        rows={query.data?.items}
        getRowId={(r) => r.id}
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
            <InputGroup className="w-full sm:w-72">
              <InputGroupAddon>
                <Icon name="search" />
              </InputGroupAddon>
              <InputGroupInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Search by email" aria-label="Search by email" />
            </InputGroup>
            <FilterSelect
              label="Status"
              anyLabel="Any status"
              value={filters.status}
              options={STATUSES.map((s) => ({ value: s, label: STATUS[s]?.label ?? s }))}
              onChange={(status) => void setFilters({ status, page: 1 })}
              className="sm:w-52"
            />
          </>
        }
        emptyState={<StateView icon="userAdd" title="No sign-ups yet" description="Stores that register on the platform website appear here." />}
        noResultsState={<StateView icon="search" title="No registrations match" description="Try another email or status." />}
      />
    </>
  )
}
