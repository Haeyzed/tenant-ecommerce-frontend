"use client"

import { useQuery } from "@tanstack/react-query"
import { parseAsStringLiteral, useQueryState } from "nuqs"
import { useState } from "react"

import { useCan } from "@workspace/access/react"
import { ErrorState } from "@workspace/admin-kit/states"
import { isApiError } from "@workspace/api-client"
import { formatDate, formatMoney, formatPercent, formatRelative } from "@workspace/format"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { toast } from "@workspace/ui/components/toast"
import { Icon } from "@workspace/ui/icons"

import { DetailCard } from "@/features/billing/details"
import { StatusLabel } from "@/features/billing/labels"
import { optionLabel, useLookup } from "@/features/lookups"
import { useConsole } from "@/shell/console-context"

import { allowedAffiliateActions, affiliateQuery, useAffiliateAction, useChangeReferralCode, type AffiliateAction, type AffiliateDetails } from "./api"
import { CommissionsTable } from "./commissions-table"
import { AFFILIATE_STATUS, PAYOUT_METHOD, REFERRAL_STATUS, REFERRAL_STATUSES, detailLabel, textOf } from "./labels"
import { PayoutsTable } from "./payouts-table"
import { RateDialog } from "./rate-dialog"
import { ReasonDialog, type ReasonPrompt } from "./reason-dialog"
import { ReferralsTable } from "./referrals-table"

const TABS = ["overview", "referrals", "commissions", "payouts"] as const

/** One affiliate (spec §25.1, §21A.10): status, programme terms, balances, and their referrals, commissions and payouts. */
export function AffiliateDetail({ id }: { id: number }) {
  const { display } = useConsole()
  const query = useQuery(affiliateQuery(id))
  const countries = useLookup("countries")
  const [tab, setTab] = useQueryState("tab", parseAsStringLiteral(TABS).withDefault("overview"))

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} size="page" />

  const details = query.data
  const a = details.affiliate

  return (
    <>
      <PageHeader title={a.name} description={a.email} meta={<StatusLabel map={AFFILIATE_STATUS} value={a.status} />} actions={<AffiliateActions id={id} details={details} />} />

      {a.status === "pending" && !a.email_verified ? (
        <Alert>
          <Icon name="info" />
          <AlertTitle>Email not verified yet</AlertTitle>
          <AlertDescription>The applicant must verify their email before you can approve them.</AlertDescription>
        </Alert>
      ) : null}
      {details.rapid_refund ? (
        <Alert variant="destructive">
          <Icon name="alert" />
          <AlertTitle>Rapid refunds</AlertTitle>
          <AlertDescription>Several stores this affiliate referred were refunded soon after paying. Review their referrals before approving commissions.</AlertDescription>
        </Alert>
      ) : null}
      {(a.status === "suspended" || a.status === "closed") && a.status_reason ? (
        <Alert variant="destructive">
          <Icon name="error" />
          <AlertTitle>{a.status === "suspended" ? "Suspended" : "Closed"}</AlertTitle>
          <AlertDescription>{a.status_reason}</AlertDescription>
        </Alert>
      ) : null}
      {a.status === "rejected" && a.rejection_reason ? (
        <Alert>
          <Icon name="info" />
          <AlertTitle>Application rejected</AlertTitle>
          <AlertDescription>{a.rejection_reason}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => void setTab(TABS.find((x) => x === v) ?? "overview")}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-4 pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <ProgrammeCard id={id} details={details} />
            <DetailCard
              title="Profile"
              details={[
                { term: "Phone", value: a.phone },
                { term: "Company", value: a.company_name },
                {
                  term: "Website",
                  value: a.website_url ? (
                    <a href={a.website_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                      {a.website_url}
                    </a>
                  ) : null,
                },
                { term: "Country", value: a.country_id ? optionLabel(countries.data, String(a.country_id)) : null },
                { term: "Applied", value: formatDate(a.created_at, display) },
                { term: "Approved", value: a.approved_at ? formatDate(a.approved_at, display) : null },
                { term: "Last signed in", value: a.last_login_at ? formatRelative(a.last_login_at) : "Never" },
                { term: "How they promote", value: a.promotion_methods, wide: true },
              ]}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <BalancesCard balances={details.balances} />
            <DetailCard
              title="Referrals"
              details={REFERRAL_STATUSES.map((s) => ({ term: REFERRAL_STATUS[s]?.label ?? s, value: String(details.referrals[s] ?? 0) }))}
            />
          </div>
          <PayoutDetailsCard details={details} />
        </TabsContent>
        <TabsContent value="referrals" className="pt-4">
          {tab === "referrals" ? <ReferralsTable affiliateId={id} /> : null}
        </TabsContent>
        <TabsContent value="commissions" className="pt-4">
          {tab === "commissions" ? <CommissionsTable affiliateId={id} /> : null}
        </TabsContent>
        <TabsContent value="payouts" className="pt-4">
          {tab === "payouts" ? <PayoutsTable affiliateId={id} /> : null}
        </TabsContent>
      </Tabs>
    </>
  )
}

const ACTION_COPY: Record<AffiliateAction, { menu: string; done: string }> = {
  approve: { menu: "Approve", done: "Affiliate approved" },
  reject: { menu: "Reject", done: "Application rejected" },
  suspend: { menu: "Suspend", done: "Affiliate suspended" },
  reinstate: { menu: "Reinstate", done: "Affiliate reinstated" },
  close: { menu: "Close account", done: "Affiliate closed" },
}

function promptFor(action: AffiliateAction, name: string): ReasonPrompt {
  switch (action) {
    case "approve":
      return {
        title: `Approve ${name}?`,
        description: "They can sign in to the affiliate portal and start referring stores. Leave the code empty to generate one.",
        confirmLabel: "Approve",
        text: "optional",
        textLabel: "Referral code",
        textHint: "4 to 20 letters and digits, e.g. ADA2026.",
        singleLine: true,
        maxLength: 20,
      }
    case "reject":
      return {
        title: `Reject ${name}'s application?`,
        description: "They are emailed the reason and can apply again later.",
        confirmLabel: "Reject",
        destructive: true,
        text: "required",
      }
    case "suspend":
      return {
        title: `Suspend ${name}?`,
        description: "Their code and link stop working, new referrals earn nothing, and payouts pause until you reinstate them. Existing balances are kept.",
        confirmLabel: "Suspend",
        destructive: true,
        text: "required",
      }
    case "reinstate":
      return {
        title: `Reinstate ${name}?`,
        description: "Their code and link work again straight away.",
        confirmLabel: "Reinstate",
        text: "none",
      }
    case "close":
      return {
        title: `Close ${name}'s account?`,
        description: "They are signed out and can no longer sign in or earn commissions. Unpaid balances are not included in future payouts. This can't be undone.",
        confirmLabel: "Close account",
        destructive: true,
        text: "required",
      }
  }
}

const ERRORS: Record<string, string> = {
  affiliate_email_unverified: "The applicant hasn't verified their email yet.",
  invalid_transition: "This affiliate's status has changed. Close this and refresh.",
}

function AffiliateActions({ id, details }: { id: number; details: AffiliateDetails }) {
  const a = details.affiliate
  const mutation = useAffiliateAction(id)
  const [current, setCurrent] = useState<AffiliateAction | null>(null)
  const can: Record<AffiliateAction, boolean> = {
    approve: useCan("landlord.affiliates.admin.approve"),
    reject: useCan("landlord.affiliates.admin.reject"),
    suspend: useCan("landlord.affiliates.admin.suspend"),
    reinstate: useCan("landlord.affiliates.admin.reinstate"),
    close: useCan("landlord.affiliates.admin.close"),
  }
  const available = allowedAffiliateActions(a.status).filter((x) => can[x])
  if (available.length === 0) return null

  const primary = available.find((x) => x === "approve" || x === "reinstate") ?? null
  const rest = available.filter((x) => x !== primary)

  async function run(text: string): Promise<string | null> {
    if (!current) return null
    try {
      await mutation.mutateAsync(current === "approve" ? { action: current, referralCode: text || undefined } : { action: current, reason: text || undefined })
      toast.add({ title: ACTION_COPY[current].done, type: "success" })
      setCurrent(null)
      return null
    } catch (e) {
      if (!isApiError(e)) return "That didn't work. Try again."
      return e.fieldErrors.referral_code?.[0] ?? e.fieldErrors.reason?.[0] ?? ERRORS[e.code] ?? e.message
    }
  }

  return (
    <>
      {primary ? <Button onClick={() => setCurrent(primary)}>{ACTION_COPY[primary].menu}</Button> : null}
      {rest.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" aria-label="More actions" />}>
            Actions
            <Icon name="arrowDown" data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {rest.map((x) => (
              <DropdownMenuItem key={x} variant={x === "approve" || x === "reinstate" ? "default" : "destructive"} onClick={() => setCurrent(x)}>
                {ACTION_COPY[x].menu}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <ReasonDialog
        key={current ?? "none"}
        prompt={current ? promptFor(current, a.name) : null}
        pending={mutation.isPending}
        onConfirm={run}
        onClose={() => setCurrent(null)}
      />
    </>
  )
}

function ProgrammeCard({ id, details }: { id: number; details: AffiliateDetails }) {
  const a = details.affiliate
  const canRate = useCan("landlord.affiliates.admin.commission-rate")
  const canCode = useCan("landlord.affiliates.admin.referral-code")
  const changeCode = useChangeReferralCode(id)
  const [editingRate, setEditingRate] = useState(false)
  const [editingCode, setEditingCode] = useState(false)
  const hasCode = a.status === "approved" || a.status === "suspended"
  const custom = a.commission_rate !== null && a.commission_rate !== undefined

  async function copyLink() {
    if (!a.referral_link) return
    try {
      await navigator.clipboard.writeText(a.referral_link)
      toast.add({ title: "Referral link copied", type: "success" })
    } catch {
      toast.add({ title: "Couldn't copy", description: "Select the link and copy it manually.", type: "error" })
    }
  }

  async function saveCode(code: string): Promise<string | null> {
    try {
      await changeCode.mutateAsync(code)
      toast.add({ title: "Referral code changed", description: "The old code stops working now. Links already shared keep crediting this affiliate.", type: "success" })
      setEditingCode(false)
      return null
    } catch (e) {
      if (!isApiError(e)) return "That didn't work. Try again."
      return e.fieldErrors.referral_code?.[0] ?? (e.code === "affiliate_not_active" ? "Only approved or suspended affiliates have a code." : e.message)
    }
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Programme</CardTitle>
        <CardDescription>The code and link that credit this affiliate, and their commission rate.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-muted-foreground">Referral code</span>
            <span className="font-mono font-medium">{a.referral_code ?? "Given on approval"}</span>
          </div>
          {hasCode && canCode ? (
            <Button variant="outline" size="sm" onClick={() => setEditingCode(true)}>
              Change code
            </Button>
          ) : null}
        </div>
        {a.referral_link ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-muted-foreground">Referral link</span>
              <span className="truncate">{a.referral_link}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => void copyLink()}>
              <Icon name="copy" data-icon="inline-start" />
              Copy
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-muted-foreground">Commission rate</span>
            <span className="font-medium tabular-nums">
              {formatPercent(a.effective_commission_rate)} <span className="font-normal text-muted-foreground">{custom ? "custom rate" : "platform default"}</span>
            </span>
          </div>
          {canRate && a.status !== "rejected" && a.status !== "closed" ? (
            <Button variant="outline" size="sm" onClick={() => setEditingRate(true)}>
              Change rate
            </Button>
          ) : null}
        </div>
      </CardContent>
      <RateDialog id={id} affiliate={a} open={editingRate} onClose={() => setEditingRate(false)} />
      <ReasonDialog
        key={editingCode ? "code" : "none"}
        prompt={
          editingCode
            ? {
                title: "Change the referral code?",
                description: "The current code stops working at once. Links and cookies already issued keep crediting this affiliate.",
                confirmLabel: "Change code",
                text: "required",
                textLabel: "New code",
                textHint: "4 to 20 letters and digits.",
                singleLine: true,
                maxLength: 20,
                requiredMessage: "Enter the new code.",
              }
            : null
        }
        pending={changeCode.isPending}
        onConfirm={saveCode}
        onClose={() => setEditingCode(false)}
      />
    </Card>
  )
}

function BalancesCard({ balances }: { balances: AffiliateDetails["balances"] }) {
  const currencies = Object.keys(balances)
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Balances</CardTitle>
        <CardDescription>Payable commissions are approved and waiting for the next payout.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {currencies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No commissions yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Currency</TableHead>
                <TableHead className="text-end">Pending</TableHead>
                <TableHead className="text-end">Payable</TableHead>
                <TableHead className="text-end">Paid</TableHead>
                <TableHead className="text-end">Reversed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currencies.map((code) => {
                const b = balances[code]
                return b ? (
                  <TableRow key={code}>
                    <TableCell className="font-medium">{code}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatMoney(b.pending, code)}</TableCell>
                    <TableCell className="text-end font-medium tabular-nums">{formatMoney(b.payable, code)}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatMoney(b.paid, code)}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatMoney(b.reversed, code)}</TableCell>
                  </TableRow>
                ) : null
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function PayoutDetailsCard({ details }: { details: AffiliateDetails }) {
  const { display } = useConsole()
  const payout = details.affiliate.payout
  const entries = Object.entries(payout.details)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payout details</CardTitle>
        <CardDescription>
          {payout.method
            ? `${textOf(PAYOUT_METHOD, payout.method)}${payout.updated_at ? `, updated ${formatDate(payout.updated_at, display)}` : ""}. Account numbers show their last four digits.`
            : "Not given yet. Payouts wait until the affiliate adds them in the portal."}
        </CardDescription>
      </CardHeader>
      {entries.length > 0 ? (
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {entries.map(([key, value]) => (
              <div key={key} className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">{detailLabel(key)}</dt>
                <dd className="font-medium break-all">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      ) : null}
    </Card>
  )
}
