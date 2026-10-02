"use client"

import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"

import { normalizeKpis } from "@workspace/admin-kit/dashboard"
import { unwrap, unwrapPage } from "@workspace/api-client"
import type { components, operations } from "@workspace/contract/landlord"

import { api } from "@/shell/api-client"

export type Affiliate = components["schemas"]["AffiliateResource"]
export type AffiliateDetails = operations["landlord.affiliates.admin.show"]["responses"][200]["content"]["application/json"]["data"]
export type Referral = components["schemas"]["AffiliateReferralResource"]
export type Commission = components["schemas"]["AffiliateCommissionResource"]
export type Payout = components["schemas"]["AffiliatePayoutResource"]

export type AffiliateFilters = NonNullable<operations["landlord.affiliates.admin.index"]["parameters"]["query"]>
export type ReferralFilters = NonNullable<operations["landlord.affiliates.admin.referrals.index"]["parameters"]["query"]>
export type CommissionFilters = NonNullable<operations["landlord.affiliates.admin.commissions.index"]["parameters"]["query"]>
export type PayoutFilters = NonNullable<operations["landlord.affiliates.admin.payouts.index"]["parameters"]["query"]>

/**
 * One key root for every affiliate query: approving, rejecting or paying
 * one record changes the others (a rejected referral rejects its
 * commissions, a payout pays them), so a mutation refreshes them all.
 */
const root = ["affiliates"] as const

export const affiliatesQuery = (filters: AffiliateFilters) =>
  queryOptions({
    queryKey: [...root, "list", filters] as const,
    queryFn: ({ signal }) => unwrapPage(api.GET("/admin/affiliates", { params: { query: filters }, signal })),
  })

export const affiliateQuery = (id: number) =>
  queryOptions({
    queryKey: [...root, "detail", id] as const,
    queryFn: ({ signal }) => unwrap(api.GET("/admin/affiliates/{affiliate}", { params: { path: { affiliate: id } }, signal })),
  })

export const referralsQuery = (filters: ReferralFilters) =>
  queryOptions({
    queryKey: [...root, "referrals", filters] as const,
    queryFn: ({ signal }) => unwrapPage(api.GET("/admin/affiliate-referrals", { params: { query: filters }, signal })),
  })

export const commissionsQuery = (filters: CommissionFilters) =>
  queryOptions({
    queryKey: [...root, "commissions", filters] as const,
    queryFn: ({ signal }) => unwrapPage(api.GET("/admin/affiliate-commissions", { params: { query: filters }, signal })),
  })

export const payoutsQuery = (filters: PayoutFilters) =>
  queryOptions({
    queryKey: [...root, "payouts", filters] as const,
    queryFn: ({ signal }) => unwrapPage(api.GET("/admin/affiliate-payouts", { params: { query: filters }, signal })),
  })

export const payoutQuery = (id: number) =>
  queryOptions({
    queryKey: [...root, "payout", id] as const,
    queryFn: ({ signal }) => unwrap(api.GET("/admin/affiliate-payouts/{payout}", { params: { path: { payout: id } }, signal })),
  })

export const affiliateMetricsQuery = queryOptions({
  queryKey: [...root, "metrics", "affiliates"] as const,
  queryFn: async ({ signal }) => normalizeKpis(await unwrap(api.GET("/admin/affiliates/metrics", { signal }))),
})

export const commissionMetricsQuery = queryOptions({
  queryKey: [...root, "metrics", "commissions"] as const,
  queryFn: async ({ signal }) => normalizeKpis(await unwrap(api.GET("/admin/affiliate-commissions/metrics", { signal }))),
})

export const payoutMetricsQuery = queryOptions({
  queryKey: [...root, "metrics", "payouts"] as const,
  queryFn: async ({ signal }) => normalizeKpis(await unwrap(api.GET("/admin/affiliate-payouts/metrics", { signal }))),
})

function useRefresh() {
  const client = useQueryClient()
  return () => void client.invalidateQueries({ queryKey: root })
}

/** Writes the updated affiliate into its detail cache, then refreshes the rest in the background. */
function useAffiliateMutation<V>(id: number, call: (vars: V) => Promise<Affiliate>) {
  const client = useQueryClient()
  const refresh = useRefresh()
  return useMutation({
    mutationFn: call,
    onSuccess: (affiliate) => {
      client.setQueryData<AffiliateDetails>([...root, "detail", id], (d) => (d ? { ...d, affiliate } : d))
      refresh()
    },
  })
}

export type AffiliateAction = "approve" | "reject" | "suspend" | "reinstate" | "close"

export function useAffiliateAction(id: number) {
  const path = { params: { path: { affiliate: id } } }
  return useAffiliateMutation(id, async ({ action, reason, referralCode }: { action: AffiliateAction; reason?: string; referralCode?: string }) => {
    switch (action) {
      case "approve":
        return unwrap(api.POST("/admin/affiliates/{affiliate}/approve", { ...path, body: { referral_code: referralCode || null } }))
      case "reject":
        return unwrap(api.POST("/admin/affiliates/{affiliate}/reject", { ...path, body: { reason: reason ?? "" } }))
      case "suspend":
        return unwrap(api.POST("/admin/affiliates/{affiliate}/suspend", { ...path, body: { reason: reason ?? "" } }))
      case "reinstate":
        return unwrap(api.POST("/admin/affiliates/{affiliate}/reinstate", path))
      case "close":
        return unwrap(api.POST("/admin/affiliates/{affiliate}/close", { ...path, body: { reason: reason ?? "" } }))
    }
  })
}

/** The actions an affiliate's status allows (AffiliateService transitions). */
export function allowedAffiliateActions(status: string): AffiliateAction[] {
  switch (status) {
    case "pending":
      return ["approve", "reject"]
    case "approved":
      return ["suspend", "close"]
    case "suspended":
      return ["reinstate", "close"]
    default:
      return []
  }
}

export function useSetCommissionRate(id: number) {
  return useAffiliateMutation(id, async (body: { commission_rate: number | null; reason: string }) =>
    unwrap(api.PATCH("/admin/affiliates/{affiliate}/commission-rate", { params: { path: { affiliate: id } }, body }))
  )
}

export function useChangeReferralCode(id: number) {
  return useAffiliateMutation(id, async (referral_code: string) =>
    unwrap(api.PATCH("/admin/affiliates/{affiliate}/referral-code", { params: { path: { affiliate: id } }, body: { referral_code } }))
  )
}

export function useReferralAction() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async ({ id, action, text }: { id: number; action: "reject" | "clear-flags"; text: string }) =>
      action === "reject"
        ? unwrap(api.POST("/admin/affiliate-referrals/{referral}/reject", { params: { path: { referral: id } }, body: { reason: text } }))
        : unwrap(api.POST("/admin/affiliate-referrals/{referral}/clear-flags", { params: { path: { referral: id } }, body: { note: text } })),
    onSuccess: refresh,
  })
}

export type CommissionAction = "approve" | "reject" | "reverse"

export function useCommissionAction() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async ({ id, action, text }: { id: number; action: CommissionAction; text: string }) => {
      const path = { params: { path: { commission: id } } }
      switch (action) {
        case "approve":
          return unwrap(api.POST("/admin/affiliate-commissions/{commission}/approve", { ...path, body: { note: text || null } }))
        case "reject":
          return unwrap(api.POST("/admin/affiliate-commissions/{commission}/reject", { ...path, body: { reason: text } }))
        case "reverse":
          return unwrap(api.POST("/admin/affiliate-commissions/{commission}/reverse", { ...path, body: { reason: text } }))
      }
    },
    onSuccess: refresh,
  })
}

/** What a commission's state allows (AffiliateCommissionService). */
export function allowedCommissionActions(c: Pick<Commission, "status" | "type">): CommissionAction[] {
  if (c.type !== "commission") return []
  return c.status === "pending" ? ["approve", "reject", "reverse"] : c.status === "approved" ? ["reject", "reverse"] : []
}

export function useGeneratePayouts() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async (periodEnd: string) => unwrap(api.POST("/admin/affiliate-payouts/generate", { body: { period_end: periodEnd } })),
    onSuccess: refresh,
  })
}

export type PayoutAction = "mark-paid" | "mark-failed" | "cancel"

export function usePayoutAction(id: number) {
  const client = useQueryClient()
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async ({ action, text, idempotencyKey }: { action: PayoutAction; text: string; idempotencyKey: string }) => {
      const path = { params: { path: { payout: id } } }
      switch (action) {
        case "mark-paid":
          return unwrap(
            api.POST("/admin/affiliate-payouts/{payout}/mark-paid", {
              ...path,
              body: { external_reference: text },
              headers: { "Idempotency-Key": idempotencyKey },
            })
          )
        case "mark-failed":
          return unwrap(api.POST("/admin/affiliate-payouts/{payout}/mark-failed", { ...path, body: { reason: text } }))
        case "cancel":
          return unwrap(api.POST("/admin/affiliate-payouts/{payout}/cancel", path))
      }
    },
    onSuccess: (payout) => {
      // Keep the cached commissions and details; the action changes only the payout's own fields.
      client.setQueryData<Payout>([...root, "payout", id], (p) => (p ? { ...payout, commissions: p.commissions, payout_details: p.payout_details } : p))
      refresh()
    },
  })
}

/** What a payout's state allows. Failing a paid payout is for super-admins; the API enforces it. */
export function allowedPayoutActions(status: string): PayoutAction[] {
  return status === "pending" ? ["mark-paid", "mark-failed", "cancel"] : status === "paid" ? ["mark-failed"] : []
}
