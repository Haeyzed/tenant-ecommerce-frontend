"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useState } from "react"

import { useCan } from "@workspace/access/react"
import { ErrorState } from "@workspace/admin-kit/states"
import { isApiError } from "@workspace/api-client"
import { formatDateTime, formatMoney } from "@workspace/format"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { Table, TableBody, TableCell, TableRow } from "@workspace/ui/components/table"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"
import { Icon } from "@workspace/ui/icons"

import { DetailCard } from "@/features/billing/details"
import { ModeBadge, PROVIDER_LABELS, StatusLabel, TRANSACTION_STATUS, TRANSACTION_TYPE } from "@/features/billing/labels"
import { useConsole } from "@/shell/console-context"

import { lineItems, transactionQuery, useRefund, type Transaction } from "./api"

const isPositive = (amount: string | null | undefined) => amount !== null && amount !== undefined && Number(amount) > 0

/** One transaction (spec §25.1): amounts, line items, gateway data and refunds. */
export function TransactionDetail({ id }: { id: number }) {
  const { display } = useConsole()
  const query = useQuery(transactionQuery(id))
  const [refunding, setRefunding] = useState(false)
  const canRefund = useCan("landlord.billing.payment-transactions.refund")

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} size="page" />

  const t = query.data
  const items = lineItems(t)
  const refundable = t.refundable_amount ?? null
  const meta = t.meta && Object.keys(t.meta).length > 0 ? t.meta : null

  return (
    <>
      <PageHeader
        title={`${TRANSACTION_TYPE[t.type] ?? t.type} ${formatMoney(t.amount, t.currency_code)}`}
        description={`${t.tenant?.name ?? t.tenant_id} · ${PROVIDER_LABELS[t.provider] ?? t.provider}`}
        meta={
          <>
            <StatusLabel map={TRANSACTION_STATUS} value={t.status} />
            <ModeBadge mode={t.mode} />
          </>
        }
        actions={
          canRefund && isPositive(refundable) ? (
            <Button variant="outline" onClick={() => setRefunding(true)}>
              <Icon name="returns" data-icon="inline-start" />
              Refund
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <DetailCard
          title="Payment"
          details={[
            { term: "Amount", value: <span className="tabular-nums">{formatMoney(t.amount, t.currency_code)}</span> },
            { term: "Gateway fee", value: t.fee ? formatMoney(t.fee, t.currency_code) : t.type === "charge" && t.status === "successful" ? "Not reported" : null },
            { term: "Left to refund", value: refundable !== null ? formatMoney(refundable, t.currency_code) : null },
            { term: "First paid charge", value: t.type === "charge" ? (t.is_first_paid_charge ? "Yes" : "No") : null },
            { term: "Failure reason", value: t.failure_reason, wide: true },
            { term: "Refund reason", value: t.reason, wide: true },
          ]}
        />
        <DetailCard
          title="References"
          details={[
            { term: "Tenant", value: t.tenant?.name ?? t.tenant_id },
            {
              term: "Subscription",
              value: (
                <Link href={`/subscriptions/${t.subscription_id}`} className="underline underline-offset-4">
                  #{t.subscription_id}
                </Link>
              ),
            },
            { term: "Reference", value: <span className="font-mono text-xs">{t.reference}</span> },
            { term: "Gateway reference", value: t.provider_reference ? <span className="font-mono text-xs">{t.provider_reference}</span> : null },
            {
              term: "Refund of",
              value: t.refund_of_payment_transaction_id ? (
                <Link href={`/payment-transactions/${t.refund_of_payment_transaction_id}`} className="underline underline-offset-4">
                  Transaction #{t.refund_of_payment_transaction_id}
                </Link>
              ) : null,
            },
            { term: "Created", value: formatDateTime(t.created_at, display) },
            { term: "Paid", value: t.paid_at ? formatDateTime(t.paid_at, display) : null },
          ]}
        />
      </div>

      {items.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Line items</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableBody>
                {items.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="ps-4">{item.label}</TableCell>
                    <TableCell className="pe-4 text-end tabular-nums">{formatMoney(item.amount, t.currency_code)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {meta ? (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <Icon name="arrowRight" className="size-4" />
            Gateway data
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 max-h-80 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs">{JSON.stringify(meta, null, 2)}</pre>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {refundable !== null ? <RefundDialog transaction={t} refundable={refundable} open={refunding} onOpenChange={setRefunding} /> : null}
    </>
  )
}

/**
 * Full or partial refund through the original gateway (spec §14.6). The
 * idempotency key is created when the dialog opens and reused for retries
 * of the same refund.
 */
function RefundDialog({
  transaction,
  refundable,
  open,
  onOpenChange,
}: {
  transaction: Transaction
  refundable: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const refund = useRefund(transaction.id)
  const [amount, setAmount] = useState(refundable)
  const [reason, setReason] = useState("")
  const [key, setKey] = useState(() => crypto.randomUUID())
  const [errors, setErrors] = useState<{ amount?: string; reason?: string; form?: string }>({})

  function close(next: boolean) {
    if (!next) {
      setAmount(refundable)
      setReason("")
      setErrors({})
      setKey(crypto.randomUUID())
    }
    onOpenChange(next)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const value = Number(amount)
    const next: typeof errors = {}
    if (!/^\d+(\.\d{1,4})?$/.test(amount.trim()) || value <= 0) next.amount = "Enter an amount greater than zero."
    else if (value > Number(refundable)) next.amount = `At most ${formatMoney(refundable, transaction.currency_code)} can be refunded.`
    if (!reason.trim()) next.reason = "Give a reason. It is kept with the refund."
    setErrors(next)
    if (next.amount || next.reason) return

    try {
      // Send no amount for a full refund, so the backend refunds exactly what is left.
      const full = value === Number(refundable)
      await refund.mutateAsync({ amount: full ? null : value, reason: reason.trim(), idempotencyKey: key })
      toast.add({ title: "Refund recorded", description: "The gateway confirms it by webhook.", type: "success" })
      close(false)
    } catch (error) {
      if (isApiError(error) && error.code === "refund_exceeds_payment") {
        const left = typeof error.details.refundable === "string" ? error.details.refundable : null
        setErrors({ amount: left ? `Only ${formatMoney(left, transaction.currency_code)} is left to refund.` : error.message })
        return
      }
      setErrors({ form: isApiError(error) ? error.message : "Couldn't record the refund. Try again." })
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <form noValidate onSubmit={submit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Refund {transaction.tenant?.name ?? "this payment"}</DialogTitle>
            <DialogDescription>
              The money goes back through {PROVIDER_LABELS[transaction.provider] ?? transaction.provider}. {formatMoney(refundable, transaction.currency_code)} can be refunded.
            </DialogDescription>
          </DialogHeader>
          {errors.form ? <p className="text-sm text-destructive">{errors.form}</p> : null}
          <FieldGroup>
            <Field data-invalid={errors.amount ? true : undefined}>
              <FieldLabel htmlFor="refund-amount">Amount ({transaction.currency_code})</FieldLabel>
              <Input id="refund-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-40" aria-invalid={errors.amount ? true : undefined} />
              {errors.amount ? <FieldError>{errors.amount}</FieldError> : <FieldDescription>Lower it for a partial refund.</FieldDescription>}
            </Field>
            <Field data-invalid={errors.reason ? true : undefined}>
              <FieldLabel htmlFor="refund-reason">Reason</FieldLabel>
              <Textarea id="refund-reason" rows={3} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={errors.reason ? true : undefined} />
              {errors.reason ? <FieldError>{errors.reason}</FieldError> : null}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={refund.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={refund.isPending}>
              {refund.isPending ? <Spinner data-icon="inline-start" /> : null}
              Refund
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
