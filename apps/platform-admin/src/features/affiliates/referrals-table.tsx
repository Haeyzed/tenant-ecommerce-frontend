"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { parseAsBoolean, parseAsInteger, parseAsStringLiteral, useQueryStates } from "nuqs"
import { useMemo, useState } from "react"

import { useCan } from "@workspace/access/react"
import { StateView } from "@workspace/admin-kit/states"
import { DataTable, FilterSelect, type DataColumn } from "@workspace/admin-kit/table"
import { isApiError } from "@workspace/api-client"
import { formatDate } from "@workspace/format"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { toast } from "@workspace/ui/components/toast"

import { StatusLabel, labelOf } from "@/features/billing/labels"
import { useConsole } from "@/shell/console-context"

import { AffiliateFilter } from "./affiliate-filter"
import { referralsQuery, useReferralAction, type Referral } from "./api"
import { INELIGIBLE_REASON, REFERRAL_SOURCE, REFERRAL_STATUS, REFERRAL_STATUSES, RISK_FLAG, textOf } from "./labels"
import { ReasonDialog, type ReasonPrompt } from "./reason-dialog"

type Action = { referral: Referral; kind: "reject" | "clear-flags" }

/**
 * Referred stores (spec §21A.5). Flagged referrals hold their commissions
 * until a manager clears the flags with a note, or rejects the referral,
 * which rejects its unpaid commissions too.
 */
export function ReferralsTable({ affiliateId }: { affiliateId?: number }) {
  const { display } = useConsole()
  const [filters, setFilters] = useQueryStates(
    {
      rstatus: parseAsStringLiteral(REFERRAL_STATUSES),
      review: parseAsBoolean.withDefault(false),
      affiliate: parseAsInteger,
      rpage: parseAsInteger.withDefault(1),
      rper_page: parseAsInteger.withDefault(25),
    },
    { clearOnDefault: true, history: "replace" }
  )
  const [action, setAction] = useState<Action | null>(null)
  const mutation = useReferralAction()
  const canReject = useCan("landlord.affiliates.admin.referrals.reject")
  const canClear = useCan("landlord.affiliates.admin.referrals.clear-flags")
  const affiliate = affiliateId ?? filters.affiliate ?? undefined

  const query = useQuery({
    ...referralsQuery({
      status: filters.rstatus ?? undefined,
      requires_review: filters.review || undefined,
      affiliate_id: affiliate,
      page: filters.rpage,
      per_page: filters.rper_page,
    }),
    placeholderData: keepPreviousData,
  })

  const columns = useMemo<DataColumn<Referral>[]>(
    () => [
      {
        id: "store",
        header: "Store",
        mobile: "title",
        cell: (r) => (
          <span className="flex min-w-0 flex-col">
            {r.tenant_id ? (
              <Link href={`/tenants/${encodeURIComponent(r.tenant_id)}`} className="truncate font-medium hover:underline">
                {r.business || "Unnamed store"}
              </Link>
            ) : (
              <span className="truncate font-medium">{r.business || "Unnamed store"}</span>
            )}
            <span className="truncate text-xs text-muted-foreground">{textOf(REFERRAL_SOURCE, r.source)}</span>
          </span>
        ),
      },
      ...(affiliateId === undefined
        ? [
            {
              id: "affiliate",
              header: "Affiliate",
              mobile: "subtitle",
              cell: (r: Referral) => (r.affiliate ? <Link href={`/affiliates/${r.affiliate.id}`} className="hover:underline">{r.affiliate.name}</Link> : "—"),
            } satisfies DataColumn<Referral>,
          ]
        : []),
      {
        id: "status",
        header: "Status",
        mobile: "meta",
        cell: (r) => (
          <span className="flex flex-wrap items-center gap-1">
            <StatusLabel map={REFERRAL_STATUS} value={r.status} />
            {r.requires_review ? <Badge variant="outline">To review</Badge> : null}
          </span>
        ),
      },
      {
        id: "why",
        header: "Notes",
        mobile: "detail",
        cell: (r) =>
          r.status === "ineligible" ? (
            textOf(INELIGIBLE_REASON, r.ineligible_reason)
          ) : r.risk_flags && r.risk_flags.length > 0 ? (
            <span className="flex flex-col gap-0.5">
              {r.risk_flags.map((f) => (
                <span key={f.flag} title={f.detail}>
                  {textOf(RISK_FLAG, f.flag)}
                </span>
              ))}
            </span>
          ) : (
            "—"
          ),
      },
      { id: "attributed", header: "Signed up", mobile: "detail", cell: (r) => formatDate(r.attributed_at, display) },
      {
        id: "converted",
        header: "Converted",
        mobile: "detail",
        cell: (r) => (r.converted_at ? formatDate(r.converted_at, display) : r.conversion_deadline ? `By ${formatDate(r.conversion_deadline, display)}` : "—"),
      },
    ],
    [affiliateId, display]
  )

  const prompt: ReasonPrompt | null = action
    ? action.kind === "reject"
      ? {
          title: `Reject the referral of ${action.referral.business || "this store"}?`,
          description: "The referral earns nothing, and its unpaid commissions are rejected with it. Paid commissions follow the refund rules. This can't be undone.",
          confirmLabel: "Reject referral",
          destructive: true,
          text: "required",
          textHint: "Kept with the referral's history.",
        }
      : {
          title: "Clear the review flags?",
          description: "The referral's commissions can then be approved as usual. Say why the flags are safe to clear.",
          confirmLabel: "Clear flags",
          text: "required",
          textLabel: "Note",
          maxLength: 500,
        }
    : null

  async function run(text: string): Promise<string | null> {
    if (!action) return null
    try {
      await mutation.mutateAsync({ id: action.referral.id, action: action.kind, text })
      toast.add({ title: action.kind === "reject" ? "Referral rejected" : "Flags cleared", type: "success" })
      setAction(null)
      return null
    } catch (e) {
      if (isApiError(e) && (e.code === "invalid_transition" || e.code === "referral_rejected")) return "This referral has already been rejected."
      return isApiError(e) ? e.message : "That didn't work. Try again."
    }
  }

  return (
    <>
      <DataTable<Referral>
        tableId={affiliateId === undefined ? "affiliate-referrals" : "affiliate-detail-referrals"}
        columns={columns}
        rows={query.data?.items}
        getRowId={(r) => String(r.id)}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        filtered={Boolean(filters.rstatus || filters.review || (affiliateId === undefined && filters.affiliate))}
        rowActions={(r) =>
          r.status === "rejected" ? null : (
            <div className="flex justify-end gap-1">
              {canClear && r.requires_review ? (
                <Button variant="ghost" size="sm" onClick={() => setAction({ referral: r, kind: "clear-flags" })}>
                  Clear flags
                </Button>
              ) : null}
              {canReject ? (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setAction({ referral: r, kind: "reject" })}>
                  Reject
                </Button>
              ) : null}
            </div>
          )
        }
        paging={{
          pagination: query.data?.pagination,
          onPageChange: (rpage) => void setFilters({ rpage }),
          onPerPageChange: (rper_page) => void setFilters({ rper_page, rpage: 1 }),
        }}
        toolbar={
          <>
            {affiliateId === undefined ? (
              <AffiliateFilter value={filters.affiliate} onChange={(a) => void setFilters({ affiliate: a, rpage: 1 })} className="w-full sm:w-60" />
            ) : null}
            <FilterSelect
              label="Status"
              anyLabel="Any status"
              value={filters.rstatus}
              options={REFERRAL_STATUSES.map((s) => ({ value: s, label: labelOf(REFERRAL_STATUS, s) }))}
              onChange={(rstatus) => void setFilters({ rstatus, rpage: 1 })}
            />
            <FilterSelect
              label="Review"
              anyLabel="Any"
              value={filters.review ? "review" : null}
              options={[{ value: "review", label: "To review" }]}
              onChange={(v) => void setFilters({ review: v === "review", rpage: 1 })}
            />
          </>
        }
        emptyState={<StateView icon="customers" title="No referrals yet" description="Stores that sign up through an affiliate appear here." />}
        noResultsState={<StateView icon="search" title="No referrals match" description="Try another status or affiliate." />}
      />
      <ReasonDialog
        key={action ? `${action.kind}:${action.referral.id}` : "none"}
        prompt={prompt}
        pending={mutation.isPending}
        onConfirm={run}
        onClose={() => setAction(null)}
      />
    </>
  )
}
