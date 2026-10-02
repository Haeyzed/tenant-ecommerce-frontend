"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

import { useCan } from "@workspace/access/react"
import { ErrorState } from "@workspace/admin-kit/states"
import { isApiError } from "@workspace/api-client"
import { formatDate, formatDateTime, formatMoney, formatPercent } from "@workspace/format"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { toast } from "@workspace/ui/components/toast"
import { Icon } from "@workspace/ui/icons"

import { DetailCard } from "@/features/billing/details"
import { StatusLabel } from "@/features/billing/labels"
import { useConsole } from "@/shell/console-context"

import { allowedPayoutActions, payoutQuery, usePayoutAction, type PayoutAction } from "./api"
import { AFFILIATE_COMMISSION_STATUS, PAYOUT_METHOD, PAYOUT_STATUS, detailLabel, textOf } from "./labels"
import { AffiliateLink } from "./payouts-table"
import { ReasonDialog, type ReasonPrompt } from "./reason-dialog"

const ACTION_ROUTE: Record<PayoutAction, string> = {
  "mark-paid": "landlord.affiliates.admin.payouts.mark-paid",
  "mark-failed": "landlord.affiliates.admin.payouts.mark-failed",
  cancel: "landlord.affiliates.admin.payouts.cancel",
}

/** One payout: where to send the money, what it covers, and recording the transfer (spec §21A.7). */
export function PayoutDetail({ id }: { id: number }) {
  const { display } = useConsole()
  const query = useQuery(payoutQuery(id))
  const action = usePayoutAction(id)
  const [pending, setPending] = useState<PayoutAction | null>(null)
  // One key per attempt: a retried "mark paid" is replayed, never applied twice.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const can: Record<PayoutAction, boolean> = {
    "mark-paid": useCan(ACTION_ROUTE["mark-paid"]),
    "mark-failed": useCan(ACTION_ROUTE["mark-failed"]),
    cancel: useCan(ACTION_ROUTE.cancel),
  }

  if (query.isPending) return <Skeleton className="h-96 w-full" />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} size="page" />

  const p = query.data
  const amount = formatMoney(p.amount, p.currency_code)
  const actions = allowedPayoutActions(p.status).filter((a) => can[a])

  function open(a: PayoutAction) {
    if (a === "mark-paid") setIdempotencyKey(crypto.randomUUID())
    setPending(a)
  }

  const prompt: ReasonPrompt | null =
    pending === "mark-paid"
      ? {
          title: `Mark ${amount} as paid?`,
          description: "Record this after the money has left your account. The affiliate is notified and its commissions become paid.",
          confirmLabel: "Mark paid",
          text: "required",
          textLabel: "Transfer reference",
          textHint: "The bank or PayPal transaction reference.",
          singleLine: true,
          requiredMessage: "Enter the transfer reference.",
        }
      : pending === "mark-failed"
        ? {
            title: `Mark ${amount} as failed?`,
            description:
              p.status === "paid"
                ? "Use this when a transfer was returned. Its commissions become payable again. Only a super-admin can fail a paid payout."
                : "Use this when the bank rejected the transfer. Its commissions return to the affiliate's balance for the next payout.",
            confirmLabel: "Mark failed",
            destructive: true,
            text: "required",
          }
        : pending === "cancel"
          ? {
              title: `Cancel ${p.reference}?`,
              description: "No money is sent. Its commissions return to the affiliate's balance for the next payout.",
              confirmLabel: "Cancel payout",
              destructive: true,
              text: "none",
            }
          : null

  async function run(text: string): Promise<string | null> {
    if (!pending) return null
    try {
      await action.mutateAsync({ action: pending, text, idempotencyKey })
      toast.add({ title: pending === "mark-paid" ? "Payout marked paid" : pending === "mark-failed" ? "Payout marked failed" : "Payout cancelled", type: "success" })
      setPending(null)
      return null
    } catch (e) {
      if (!isApiError(e)) return "That didn't work. Try again."
      if (e.code === "state_conflict") return "This payout's status has changed. Close this and refresh."
      if (e.status === 403) return e.message || "You can't do this."
      return e.message
    }
  }

  return (
    <>
      <PageHeader
        title={`${amount} payout`}
        description={<span className="font-mono">{p.reference}</span>}
        meta={<StatusLabel map={PAYOUT_STATUS} value={p.status} />}
        actions={
          actions.length > 0 ? (
            <>
              {actions.includes("mark-paid") ? <Button onClick={() => open("mark-paid")}>Mark paid</Button> : null}
              {actions.includes("mark-failed") ? (
                <Button variant="outline" onClick={() => open("mark-failed")}>
                  Mark failed
                </Button>
              ) : null}
              {actions.includes("cancel") ? (
                <Button variant="outline" onClick={() => open("cancel")}>
                  Cancel payout
                </Button>
              ) : null}
            </>
          ) : null
        }
      />

      {p.status === "failed" && p.failure_reason ? (
        <Alert variant="destructive">
          <Icon name="error" />
          <AlertTitle>Failed {p.failed_at ? formatDate(p.failed_at, display) : ""}</AlertTitle>
          <AlertDescription>{p.failure_reason}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <DetailCard
          title="Payout"
          details={[
            { term: "Affiliate", value: <AffiliateLink payout={p} /> },
            { term: "Period", value: `${formatDate(p.period_start, display)} – ${formatDate(p.period_end, display)}` },
            { term: "Commissions", value: String(p.commission_count) },
            { term: "Created", value: p.created_at ? formatDateTime(p.created_at, display) : "—" },
            { term: "Paid", value: p.paid_at ? formatDateTime(p.paid_at, display) : "Not yet" },
            { term: "Transfer reference", value: p.external_reference ?? "—" },
          ]}
        />
        <Card>
          <CardHeader>
            <CardTitle>Pay to</CardTitle>
            <CardDescription>{textOf(PAYOUT_METHOD, p.payout_method)}, as the affiliate gave it when this payout was created.</CardDescription>
          </CardHeader>
          <CardContent>
            {p.payout_details ? (
              <dl className="grid gap-3 sm:grid-cols-2">
                {Object.entries(p.payout_details).map(([key, value]) => (
                  <div key={key} className="flex flex-col gap-0.5">
                    <dt className="text-xs text-muted-foreground">{detailLabel(key)}</dt>
                    <dd className="font-medium break-all">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Account details are shown only to billing admins, who make the transfer.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Included commissions</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store</TableHead>
                <TableHead className="text-end">On</TableHead>
                <TableHead className="text-end">Commission</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Earned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(p.commissions ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    {c.tenant_name ?? "Unknown store"}
                    {c.type === "clawback" ? <span className="text-muted-foreground"> · clawback</span> : null}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatMoney(c.base_amount, c.currency_code)} × {formatPercent(c.commission_rate_applied)}
                  </TableCell>
                  <TableCell className="text-end font-medium tabular-nums">{formatMoney(c.amount, c.currency_code)}</TableCell>
                  <TableCell>
                    <StatusLabel map={AFFILIATE_COMMISSION_STATUS} value={c.status} />
                  </TableCell>
                  <TableCell>{c.created_at ? formatDate(c.created_at, display) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ReasonDialog key={pending ?? "none"} prompt={prompt} pending={action.isPending} onConfirm={run} onClose={() => setPending(null)} />
    </>
  )
}
