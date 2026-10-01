"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { useMemo, useState } from "react"

import { useCan } from "@workspace/access/react"
import { StateView } from "@workspace/admin-kit/states"
import { DataTable, FilterSelect, type DataColumn } from "@workspace/admin-kit/table"
import { isApiError, unwrap, unwrapPage } from "@workspace/api-client"
import type { components, operations } from "@workspace/contract/landlord"
import { formatDateTime, formatMoney, formatPercent } from "@workspace/format"
import { Button } from "@workspace/ui/components/button"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"

import { COMMISSION_STATUS, StatusLabel, labelOf } from "@/features/billing/labels"
import { useLookup } from "@/features/lookups"
import { TenantFilter } from "@/features/tenants/tenant-filter"
import { api } from "@/shell/api-client"
import { useConsole } from "@/shell/console-context"

type Commission = components["schemas"]["PlatformCommissionResource"]
type Filters = NonNullable<operations["landlord.billing.platform-commissions.index"]["parameters"]["query"]>

const STATUSES = ["pending", "billed", "collected", "waived"] as const

const params = {
  status: parseAsStringLiteral(STATUSES),
  currency: parseAsString,
  tenant: parseAsString,
  page: parseAsInteger.withDefault(1),
  per_page: parseAsInteger.withDefault(25),
}

const commissionsQuery = (filters: Filters) => ({
  queryKey: ["platform-commissions", "list", filters] as const,
  queryFn: ({ signal }: { signal: AbortSignal }) => unwrapPage(api.GET("/admin/platform-commissions", { params: { query: filters }, signal })),
})

/**
 * The platform's commission on store sales (spec §25.1, D-138): one row per
 * order payment or refund. Pending commissions can be waived with a reason.
 */
export function CommissionsPage() {
  const { display } = useConsole()
  const [filters, setFilters] = useQueryStates(params, { clearOnDefault: true, history: "replace" })
  const [waiving, setWaiving] = useState<Commission | null>(null)
  const canWaive = useCan("landlord.billing.platform-commissions.waive")
  const currencies = useLookup("currencies")

  const query = useQuery({
    ...commissionsQuery({
      status: filters.status ?? undefined,
      currency: filters.currency ?? undefined,
      tenant: filters.tenant ?? undefined,
      page: filters.page,
      per_page: filters.per_page,
    }),
    placeholderData: keepPreviousData,
  })

  const columns = useMemo<DataColumn<Commission>[]>(
    () => [
      {
        id: "tenant",
        header: "Tenant",
        mobile: "title",
        cell: (c) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{c.tenant?.name ?? c.tenant_id}</span>
            <span className="truncate text-xs text-muted-foreground">
              {c.kind === "refund" ? "Refund" : "Order"} {c.order_number ? `#${c.order_number}` : ""}
            </span>
          </span>
        ),
      },
      {
        id: "amount",
        header: "Commission",
        align: "end",
        mobile: "subtitle",
        cell: (c) => <span className="font-medium tabular-nums">{formatMoney(c.amount, c.currency_code)}</span>,
      },
      {
        id: "base",
        header: "On",
        align: "end",
        mobile: "detail",
        cell: (c) => (
          <span className="tabular-nums">
            {formatMoney(c.base_amount, c.currency_code)} × {formatPercent(c.rate)}
          </span>
        ),
      },
      { id: "status", header: "Status", mobile: "meta", cell: (c) => <StatusLabel map={COMMISSION_STATUS} value={c.status} /> },
      { id: "date", header: "Date", mobile: "detail", cell: (c) => formatDateTime(c.created_at, display) },
      { id: "reason", header: "Waived because", hideable: true, defaultHidden: true, mobile: "hidden", cell: (c) => c.waived_reason ?? "—" },
    ],
    [display]
  )

  const filtered = Boolean(filters.status || filters.currency || filters.tenant)

  return (
    <>
      <PageHeader
        title="Commissions"
        description="The platform's share of store sales, created per order payment and reversed on refunds. Collected with the store's subscription billing."
      />
      <DataTable<Commission>
        tableId="platform-commissions"
        columns={columns}
        rows={query.data?.items}
        getRowId={(c) => String(c.id)}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        filtered={filtered}
        rowActions={(c) =>
          canWaive && c.status === "pending" ? (
            <Button variant="ghost" size="sm" onClick={() => setWaiving(c)}>
              Waive
            </Button>
          ) : null
        }
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
              options={STATUSES.map((s) => ({ value: s, label: labelOf(COMMISSION_STATUS, s) }))}
              onChange={(status) => void setFilters({ status, page: 1 })}
              className="sm:w-36"
            />
            <FilterSelect
              label="Currency"
              anyLabel="Any currency"
              value={filters.currency}
              options={(currencies.data ?? []).map((c) => ({ value: c.value, label: c.value }))}
              onChange={(currency) => void setFilters({ currency, page: 1 })}
              className="sm:w-36"
            />
          </>
        }
        emptyState={<StateView icon="percent" title="No commissions yet" description="Commissions appear when stores on a commission plan take payments." />}
        noResultsState={<StateView icon="search" title="No commissions match" description="Try another tenant, status or currency." />}
      />
      <WaiveDialog commission={waiving} onClose={() => setWaiving(null)} />
    </>
  )
}

function WaiveDialog({ commission, onClose }: { commission: Commission | null; onClose: () => void }) {
  const client = useQueryClient()
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const waive = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) =>
      unwrap(api.POST("/admin/platform-commissions/{commission}/waive", { params: { path: { commission: id } }, body: { reason } })),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["platform-commissions"] }),
  })

  function close() {
    setReason("")
    setError(null)
    onClose()
  }

  async function confirm() {
    if (!commission) return
    if (!reason.trim()) {
      setError("Give a reason. It is kept with the commission.")
      return
    }
    try {
      await waive.mutateAsync({ id: commission.id, reason: reason.trim() })
      toast.add({ title: "Commission waived", type: "success" })
      close()
    } catch (e) {
      setError(isApiError(e) && e.code === "invalid_transition" ? "This commission is no longer pending, so it can't be waived." : "Couldn't waive the commission. Try again.")
    }
  }

  return (
    <ConfirmDialog
      open={commission !== null}
      onOpenChange={(open) => (open ? null : close())}
      title={`Waive ${commission ? formatMoney(commission.amount, commission.currency_code) : ""}?`}
      description={`${commission?.tenant?.name ?? "The store"} will not be charged this commission.`}
      confirmLabel="Waive"
      pending={waive.isPending}
      onConfirm={() => void confirm()}
    >
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="waive-reason">Reason</FieldLabel>
        <Textarea
          id="waive-reason"
          rows={3}
          maxLength={255}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
            setError(null)
          }}
          aria-invalid={error ? true : undefined}
        />
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
    </ConfirmDialog>
  )
}
