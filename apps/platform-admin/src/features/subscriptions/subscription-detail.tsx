"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useState } from "react"

import { useCan } from "@workspace/access/react"
import { ErrorState } from "@workspace/admin-kit/states"
import { isApiError } from "@workspace/api-client"
import { formatDate, formatDateTime, formatMoney } from "@workspace/format"
import { Button } from "@workspace/ui/components/button"
import { ButtonLink } from "@workspace/ui/components/button-link"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"
import { Icon } from "@workspace/ui/icons"

import { DetailCard } from "@/features/billing/details"
import { INTERVAL_LABELS, ModeBadge, PROVIDER_LABELS, StatusLabel, SUBSCRIPTION_STATUS, TRANSACTION_STATUS, TRANSACTION_TYPE } from "@/features/billing/labels"
import { transactionsQuery } from "@/features/payment-transactions/api"
import { useConsole } from "@/shell/console-context"

import { canTryExtendTrial, subscriptionQuery, useExtendTrial, type Subscription } from "./api"

/** One subscription (spec §25.1): plan, billing state, dates, recent payments and the trial extension. */
export function SubscriptionDetail({ id }: { id: number }) {
  const { display } = useConsole()
  const query = useQuery(subscriptionQuery(id))
  const [extending, setExtending] = useState(false)
  const canExtend = useCan("landlord.billing.subscriptions.extend-trial")

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} size="page" />

  const s = query.data
  const tenantName = s.tenant?.name ?? s.tenant_id

  return (
    <>
      <PageHeader
        title={tenantName}
        description={`${s.plan?.name ?? "Plan"} · ${INTERVAL_LABELS[s.billing_interval] ?? s.billing_interval} · ${s.currency_code}`}
        meta={
          <>
            <StatusLabel map={SUBSCRIPTION_STATUS} value={s.status} />
            <ModeBadge mode={s.gateway_mode} />
          </>
        }
        actions={
          <>
            <ButtonLink variant="outline" render={<Link href={`/payment-transactions?tenant=${encodeURIComponent(s.tenant_id)}`} />}>
              All payments
            </ButtonLink>
            {canExtend && canTryExtendTrial(s) ? (
              <Button onClick={() => setExtending(true)}>
                <Icon name="clock" data-icon="inline-start" />
                Extend trial
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <DetailCard
          title="Billing"
          details={[
            { term: "Plan", value: s.plan?.name },
            { term: "Billed", value: `${INTERVAL_LABELS[s.billing_interval] ?? s.billing_interval} in ${s.currency_code}` },
            { term: "Gateway", value: s.gateway ? `${PROVIDER_LABELS[s.gateway] ?? s.gateway} (${s.gateway_mode})` : null },
            { term: "Card on file", value: s.has_payment_method ? "Yes" : "No" },
            { term: "Scheduled change", value: s.scheduled_plan_id ? `To plan #${s.scheduled_plan_id} at renewal` : "None" },
          ]}
        />
        <DetailCard
          title="Dates"
          details={[
            { term: "Started", value: formatDate(s.starts_at, display) },
            { term: "Trial", value: s.trial_days > 0 ? `${s.trial_days} days${s.trial_ends_at ? `, ends ${formatDate(s.trial_ends_at, display)}` : ""}` : "No trial" },
            { term: "Renews", value: s.renews_at ? formatDate(s.renews_at, display) : null },
            { term: "Past due since", value: s.past_due_at ? formatDateTime(s.past_due_at, display) : null },
            { term: "Cancelled", value: s.cancelled_at ? formatDateTime(s.cancelled_at, display) : null },
            { term: "Ends", value: s.ends_at ? formatDate(s.ends_at, display) : null },
          ]}
        />
      </div>

      <RecentPayments subscription={s} />

      <ExtendTrialDialog subscription={s} open={extending} onOpenChange={setExtending} />
    </>
  )
}

function RecentPayments({ subscription }: { subscription: Subscription }) {
  const { display } = useConsole()
  const payments = useQuery(transactionsQuery({ tenant: subscription.tenant_id, per_page: 5 }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent payments</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {payments.isPending ? (
          <div className="px-4">
            <Skeleton className="h-24 w-full" />
          </div>
        ) : payments.isError ? (
          <ErrorState error={payments.error} onRetry={() => void payments.refetch()} />
        ) : payments.data.items.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <ul className="divide-y">
            {payments.data.items.map((t) => (
              <li key={t.id}>
                <Link href={`/payment-transactions/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/50">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">
                      {TRANSACTION_TYPE[t.type] ?? t.type} · {PROVIDER_LABELS[t.provider] ?? t.provider}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(t.paid_at ?? t.created_at, display)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums">{formatMoney(t.amount, t.currency_code)}</span>
                    <StatusLabel map={TRANSACTION_STATUS} value={t.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/** Trial extensions are audited, so a reason is required (spec §14.4). */
function ExtendTrialDialog({ subscription, open, onOpenChange }: { subscription: Subscription; open: boolean; onOpenChange: (open: boolean) => void }) {
  const extend = useExtendTrial(subscription.id)
  const [days, setDays] = useState("7")
  const [reason, setReason] = useState("")
  const [errors, setErrors] = useState<{ days?: string; reason?: string; form?: string }>({})
  // "Now" for the end-date preview, taken once rather than on every render.
  const [now] = useState(() => Date.now())

  function close(next: boolean) {
    if (!next) {
      setDays("7")
      setReason("")
      setErrors({})
    }
    onOpenChange(next)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const n = Number(days)
    const next: typeof errors = {}
    if (!Number.isInteger(n) || n < 1 || n > 365) next.days = "Enter 1 to 365 days."
    if (!reason.trim()) next.reason = "Give a reason. It is kept in the activity log."
    setErrors(next)
    if (next.days || next.reason) return

    try {
      const updated = await extend.mutateAsync({ days: n, reason: reason.trim() })
      toast.add({ title: "Trial extended", description: updated.trial_ends_at ? `Now ends ${formatDate(updated.trial_ends_at)}.` : undefined, type: "success" })
      close(false)
    } catch (error) {
      if (isApiError(error) && error.code === "invalid_transition") {
        setErrors({ form: "This subscription can no longer be put back on trial: it has been paid or is past its grace period." })
        return
      }
      setErrors({
        days: isApiError(error) ? error.fieldErrors.days?.join(" ") : undefined,
        reason: isApiError(error) ? error.fieldErrors.reason?.join(" ") : undefined,
        form: isApiError(error) && Object.keys(error.fieldErrors).length > 0 ? undefined : "Couldn't extend the trial. Try again.",
      })
    }
  }

  const base = subscription.trial_ends_at && Date.parse(subscription.trial_ends_at) > now ? new Date(subscription.trial_ends_at) : new Date(now)
  const n = Number(days)
  const preview = Number.isInteger(n) && n >= 1 && n <= 365 ? new Date(base.getTime() + n * 86_400_000) : null

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <form noValidate onSubmit={submit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Extend trial</DialogTitle>
            <DialogDescription>{subscription.tenant?.name ?? "The store"} keeps full access until the new end date, without being charged.</DialogDescription>
          </DialogHeader>
          {errors.form ? <p className="text-sm text-destructive">{errors.form}</p> : null}
          <FieldGroup>
            <Field data-invalid={errors.days ? true : undefined}>
              <FieldLabel htmlFor="trial-days">Extra days</FieldLabel>
              <Input id="trial-days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} className="w-32" aria-invalid={errors.days ? true : undefined} />
              {errors.days ? <FieldError>{errors.days}</FieldError> : preview ? <FieldDescription>New end date: {formatDate(preview.toISOString())}</FieldDescription> : null}
            </Field>
            <Field data-invalid={errors.reason ? true : undefined}>
              <FieldLabel htmlFor="trial-reason">Reason</FieldLabel>
              <Textarea id="trial-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={errors.reason ? true : undefined} />
              {errors.reason ? <FieldError>{errors.reason}</FieldError> : <FieldDescription>Recorded in the activity log with your name.</FieldDescription>}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={extend.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={extend.isPending}>
              {extend.isPending ? <Spinner data-icon="inline-start" /> : null}
              Extend trial
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
