"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { parseAsBoolean, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { useMemo, useState } from "react"

import { useCan } from "@workspace/access/react"
import { StateView } from "@workspace/admin-kit/states"
import { DataTable, FilterSelect, type DataColumn } from "@workspace/admin-kit/table"
import { isApiError } from "@workspace/api-client"
import { formatDate, formatDateTime, formatMoney, formatPercent } from "@workspace/format"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu"
import { toast } from "@workspace/ui/components/toast"
import { Icon } from "@workspace/ui/icons"

import { StatusLabel, labelOf } from "@/features/billing/labels"
import { useLookup } from "@/features/lookups"
import { useConsole } from "@/shell/console-context"

import { AffiliateFilter } from "./affiliate-filter"
import { allowedCommissionActions, commissionsQuery, useCommissionAction, type Commission, type CommissionAction } from "./api"
import { AFFILIATE_COMMISSION_STATUS, COMMISSION_STATUSES } from "./labels"
import { ReasonDialog, type ReasonPrompt } from "./reason-dialog"

type Pending = { commission: Commission; action: CommissionAction }

const ACTION_LABEL: Record<CommissionAction, string> = { approve: "Approve", reject: "Reject", reverse: "Reverse" }

/** Whether the hold has passed, so the commission can be approved now. */
export function holdPassed(c: Pick<Commission, "hold_until">, now: number): boolean {
  return new Date(c.hold_until).getTime() <= now
}

/**
 * Commissions affiliates earn on referred stores' payments (spec §21A.6).
 * Pending ones are approved after their hold; flagged ones need a note.
 * Clawbacks offset refunds and have no actions.
 */
export function CommissionsTable({ affiliateId }: { affiliateId?: number }) {
  const { display } = useConsole()
  const [now] = useState(() => Date.now())
  const [filters, setFilters] = useQueryStates(
    {
      cstatus: parseAsStringLiteral(COMMISSION_STATUSES),
      ctype: parseAsStringLiteral(["commission", "clawback"] as const),
      ccurrency: parseAsString,
      eligible: parseAsBoolean.withDefault(false),
      affiliate: parseAsInteger,
      cpage: parseAsInteger.withDefault(1),
      cper_page: parseAsInteger.withDefault(25),
    },
    { clearOnDefault: true, history: "replace" }
  )
  const [pending, setPending] = useState<Pending | null>(null)
  const mutation = useCommissionAction()
  const currencies = useLookup("currencies")
  const can: Record<CommissionAction, boolean> = {
    approve: useCan("landlord.affiliates.admin.commissions.approve"),
    reject: useCan("landlord.affiliates.admin.commissions.reject"),
    reverse: useCan("landlord.affiliates.admin.commissions.reverse"),
  }

  const query = useQuery({
    ...commissionsQuery({
      status: filters.cstatus ?? undefined,
      type: filters.ctype ?? undefined,
      currency_code: filters.ccurrency ?? undefined,
      eligible_only: filters.eligible || undefined,
      affiliate_id: affiliateId ?? filters.affiliate ?? undefined,
      page: filters.cpage,
      per_page: filters.cper_page,
    }),
    placeholderData: keepPreviousData,
  })

  const columns = useMemo<DataColumn<Commission>[]>(
    () => [
      {
        id: "store",
        header: affiliateId === undefined ? "Affiliate and store" : "Store",
        mobile: "title",
        cell: (c) => (
          <span className="flex min-w-0 flex-col">
            {affiliateId === undefined && c.affiliate ? (
              <Link href={`/affiliates/${c.affiliate.id}`} className="truncate font-medium hover:underline">
                {c.affiliate.name}
              </Link>
            ) : null}
            <span className={affiliateId === undefined ? "truncate text-xs text-muted-foreground" : "truncate font-medium"}>
              {c.tenant_name ?? "Unknown store"}
              {c.type === "clawback" ? " · clawback" : ""}
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
            {formatMoney(c.base_amount, c.currency_code)} × {formatPercent(c.commission_rate_applied)}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        mobile: "meta",
        cell: (c) => (
          <span className="flex flex-wrap items-center gap-1">
            <StatusLabel map={AFFILIATE_COMMISSION_STATUS} value={c.status} />
            {c.requires_review ? <Badge variant="outline">To review</Badge> : null}
          </span>
        ),
      },
      {
        id: "hold",
        header: "Approvable",
        mobile: "detail",
        cell: (c) =>
          c.status !== "pending" ? "—" : holdPassed(c, now) ? (c.requires_review ? "After review" : "Now") : `From ${formatDate(c.hold_until, display)}`,
      },
      { id: "created", header: "Earned", mobile: "detail", cell: (c) => formatDateTime(c.created_at, display) },
      {
        id: "why",
        header: "Reason",
        hideable: true,
        defaultHidden: true,
        mobile: "hidden",
        cell: (c) => c.rejection_reason ?? c.reversal_reason ?? "—",
      },
    ],
    [affiliateId, display, now]
  )

  const prompt: ReasonPrompt | null = pending ? promptFor(pending) : null

  async function run(text: string): Promise<string | null> {
    if (!pending) return null
    try {
      await mutation.mutateAsync({ id: pending.commission.id, action: pending.action, text })
      toast.add({ title: `Commission ${pending.action === "approve" ? "approved" : pending.action === "reject" ? "rejected" : "reversed"}`, type: "success" })
      setPending(null)
      return null
    } catch (e) {
      if (!isApiError(e)) return "That didn't work. Try again."
      if (e.code === "commission_on_hold") return `This commission is on hold until ${formatDate(pending.commission.hold_until, display)}.`
      if (e.code === "review_note_required") return "This commission is under review. Add a note saying why it's safe to approve."
      if (e.code === "invalid_transition") return "This commission's status has changed. Refresh to see what you can do now."
      return e.message
    }
  }

  return (
    <>
      <DataTable<Commission>
        tableId={affiliateId === undefined ? "affiliate-commissions" : "affiliate-detail-commissions"}
        columns={columns}
        rows={query.data?.items}
        getRowId={(c) => String(c.id)}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        filtered={Boolean(filters.cstatus || filters.ctype || filters.ccurrency || filters.eligible || (affiliateId === undefined && filters.affiliate))}
        rowActions={(c) => {
          const actions = allowedCommissionActions(c).filter((a) => can[a] && (a !== "approve" || holdPassed(c, now)))
          if (actions.length === 0) return null
          const [first, ...rest] = actions
          return (
            <div className="flex justify-end gap-1">
              {first === "approve" ? (
                <Button variant="ghost" size="sm" onClick={() => setPending({ commission: c, action: "approve" })}>
                  Approve
                </Button>
              ) : null}
              {(first === "approve" ? rest : actions).length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}>
                    <Icon name="more" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(first === "approve" ? rest : actions).map((a) => (
                      <DropdownMenuItem key={a} variant="destructive" onClick={() => setPending({ commission: c, action: a })}>
                        {ACTION_LABEL[a]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          )
        }}
        paging={{
          pagination: query.data?.pagination,
          onPageChange: (cpage) => void setFilters({ cpage }),
          onPerPageChange: (cper_page) => void setFilters({ cper_page, cpage: 1 }),
        }}
        toolbar={
          <>
            {affiliateId === undefined ? (
              <AffiliateFilter value={filters.affiliate} onChange={(a) => void setFilters({ affiliate: a, cpage: 1 })} className="w-full sm:w-60" />
            ) : null}
            <FilterSelect
              label="Status"
              anyLabel="Any status"
              value={filters.cstatus}
              options={COMMISSION_STATUSES.map((s) => ({ value: s, label: labelOf(AFFILIATE_COMMISSION_STATUS, s) }))}
              onChange={(cstatus) => void setFilters({ cstatus, cpage: 1 })}
            />
            <FilterSelect
              label="Type"
              anyLabel="Any type"
              value={filters.ctype}
              options={[
                { value: "commission", label: "Commissions" },
                { value: "clawback", label: "Clawbacks" },
              ]}
              onChange={(ctype) => void setFilters({ ctype, cpage: 1 })}
            />
            <FilterSelect
              label="Currency"
              anyLabel="Any currency"
              value={filters.ccurrency}
              options={(currencies.data ?? []).map((c) => ({ value: c.value, label: c.value }))}
              onChange={(ccurrency) => void setFilters({ ccurrency, cpage: 1 })}
              className="sm:w-36"
            />
            <FilterSelect
              label="Approval"
              anyLabel="Any"
              value={filters.eligible ? "eligible" : null}
              options={[{ value: "eligible", label: "Ready to approve" }]}
              onChange={(v) => void setFilters({ eligible: v === "eligible", cpage: 1 })}
            />
          </>
        }
        emptyState={<StateView icon="percent" title="No commissions yet" description="Commissions appear when referred stores pay for their plan." />}
        noResultsState={<StateView icon="search" title="No commissions match" description="Try another status, type or currency." />}
      />
      <ReasonDialog
        key={pending ? `${pending.action}:${pending.commission.id}` : "none"}
        prompt={prompt}
        pending={mutation.isPending}
        onConfirm={run}
        onClose={() => setPending(null)}
      />
    </>
  )
}

function promptFor({ commission: c, action }: Pending): ReasonPrompt {
  const amount = formatMoney(c.amount, c.currency_code)
  switch (action) {
    case "approve":
      return {
        title: `Approve ${amount}?`,
        description: "It becomes payable and is included in the affiliate's next payout.",
        confirmLabel: "Approve",
        text: c.requires_review ? "required" : "optional",
        textLabel: "Note",
        textHint: c.requires_review ? "This commission was flagged for review. Say why it's safe to approve." : undefined,
        maxLength: 500,
      }
    case "reject":
      return {
        title: `Reject ${amount}?`,
        description: "The affiliate won't be paid this commission, and it is removed from any unpaid payout. The affiliate is told the reason.",
        confirmLabel: "Reject",
        destructive: true,
        text: "required",
      }
    case "reverse":
      return {
        title: `Reverse ${amount}?`,
        description: "Use this when the payment it came from was undone. It is removed from any unpaid payout.",
        confirmLabel: "Reverse",
        destructive: true,
        text: "required",
      }
  }
}
