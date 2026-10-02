"use client"

import { useQuery } from "@tanstack/react-query"

import { KpiStrip } from "@workspace/admin-kit/dashboard"
import { PageHeader } from "@workspace/ui/components/page-header"

import { commissionMetricsQuery, payoutMetricsQuery } from "./api"
import { CommissionsTable } from "./commissions-table"
import { GeneratePayoutsButton, PayoutsTable } from "./payouts-table"
import { ReferralsTable } from "./referrals-table"

/** Every referred store across affiliates (spec §25.1). */
export function ReferralsPage() {
  return (
    <>
      <PageHeader
        title="Referrals"
        description="Stores that signed up through an affiliate. Flagged referrals hold their commissions until you clear the flags or reject the referral."
      />
      <ReferralsTable />
    </>
  )
}

/** Affiliate commissions across affiliates (spec §25.1). */
export function AffiliateCommissionsPage() {
  const metrics = useQuery(commissionMetricsQuery)
  return (
    <>
      <PageHeader
        title="Affiliate commissions"
        description="Earned on referred stores' payments. Each waits out its hold before approval, so refunds can be caught first."
      />
      <KpiStrip kpis={metrics.data} loading={metrics.isPending} placeholders={4} />
      <CommissionsTable />
    </>
  )
}

/** Affiliate payouts (spec §25.1). */
export function PayoutsPage() {
  const metrics = useQuery(payoutMetricsQuery)
  return (
    <>
      <PageHeader
        title="Affiliate payouts"
        description="Approved commissions grouped per affiliate and currency. Pay each one outside the platform, then record the transfer."
        actions={<GeneratePayoutsButton />}
      />
      <KpiStrip kpis={metrics.data} loading={metrics.isPending} placeholders={4} />
      <PayoutsTable />
    </>
  )
}
