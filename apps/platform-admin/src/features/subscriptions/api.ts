"use client"

import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"

import { normalizeKpis } from "@workspace/admin-kit/dashboard"
import { unwrap, unwrapPage } from "@workspace/api-client"
import type { components, operations } from "@workspace/contract/landlord"

import { api } from "@/shell/api-client"

export type Subscription = components["schemas"]["SubscriptionResource"]
export type SubscriptionFilters = NonNullable<operations["landlord.billing.subscriptions.index"]["parameters"]["query"]>

export const SUBSCRIPTION_STATUSES = ["incomplete", "trialing", "active", "past_due", "cancelled"] as const
export const MODES = ["live", "test"] as const

export const subscriptionKeys = {
  all: ["subscriptions"] as const,
  list: (filters: SubscriptionFilters) => [...subscriptionKeys.all, "list", filters] as const,
  detail: (id: number) => [...subscriptionKeys.all, "detail", id] as const,
  metrics: (mode: string) => [...subscriptionKeys.all, "metrics", mode] as const,
}

export const subscriptionsQuery = (filters: SubscriptionFilters) =>
  queryOptions({
    queryKey: subscriptionKeys.list(filters),
    queryFn: ({ signal }) => unwrapPage(api.GET("/admin/subscriptions", { params: { query: filters }, signal })),
  })

export const subscriptionQuery = (id: number) =>
  queryOptions({
    queryKey: subscriptionKeys.detail(id),
    queryFn: ({ signal }) => unwrap(api.GET("/admin/subscriptions/{subscription}", { params: { path: { subscription: id } }, signal })),
  })

/** The list's KPI strip; money figures follow the list's live/test filter. */
export const subscriptionMetricsQuery = (mode: "live" | "test") =>
  queryOptions({
    queryKey: subscriptionKeys.metrics(mode),
    queryFn: async ({ signal }) => normalizeKpis(await unwrap(api.GET("/admin/subscriptions/metrics", { params: { query: { mode } }, signal }))),
    staleTime: 2 * 60_000,
  })

export function useExtendTrial(id: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (body: { days: number; reason: string }) =>
      unwrap(api.POST("/admin/subscriptions/{subscription}/extend-trial", { params: { path: { subscription: id } }, body })),
    onSuccess: (subscription) => {
      client.setQueryData(subscriptionKeys.detail(id), subscription)
      void client.invalidateQueries({ queryKey: subscriptionKeys.all })
    },
  })
}

/**
 * Whether the backend may allow a trial extension: a trialing
 * subscription, or a past-due one still inside its first trial's grace
 * period (the backend makes the final call).
 */
export function canTryExtendTrial(subscription: Subscription): boolean {
  return subscription.status === "trialing" || (subscription.status === "past_due" && subscription.trial_ends_at !== null)
}
