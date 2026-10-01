"use client"

import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"

import { unwrap } from "@workspace/api-client"
import type { components, operations } from "@workspace/contract/landlord"

import { api } from "@/shell/api-client"

type RawPlan = components["schemas"]["PlanResource"]
type RawPrice = components["schemas"]["PlanPriceResource"]
type RawLimit = operations["landlord.plans.limits.index"]["responses"][200]["content"]["application/json"]["data"][number]

export type PlanBody = NonNullable<operations["landlord.plans.update"]["requestBody"]>["content"]["application/json"]
export type PriceBody = operations["landlord.plans.prices.store"]["requestBody"]["content"]["application/json"]
export type PriceUpdateBody = NonNullable<operations["landlord.plans.prices.update"]["requestBody"]>["content"]["application/json"]

export type PlanPrice = {
  id: number
  currency: string
  interval: "monthly" | "yearly"
  amount: string
  /** The price's own trial; null falls back to the platform default. */
  trialDays: number | null
  /** The trial a new subscriber actually gets. */
  resolvedTrialDays: number
  trialRequiresCard: boolean
  active: boolean
  createdAt: string | null
}

/** @source App\Modules\Plans\Http\Resources\PlanResource */
export type Plan = {
  id: number
  name: string
  slug: string
  description: string | null
  tagline: string | null
  active: boolean
  public: boolean
  recommended: boolean
  badge: string | null
  sortOrder: number
  prices: PlanPrice[]
  features: string[]
  limits: Record<string, number | null>
}

/** One row of the limit registry with this plan's value (spec §11.8). */
export type PlanLimit = {
  key: string
  label: string
  kind: string
  value: number | null
  configured: boolean
  unlimitedAllowed: boolean
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)

function normalizePrice(row: RawPrice): PlanPrice {
  return {
    id: row.id,
    currency: row.currency_code,
    interval: row.billing_interval === "yearly" ? "yearly" : "monthly",
    amount: row.amount,
    trialDays: row.trial_days,
    resolvedTrialDays: row.resolved_trial_days,
    trialRequiresCard: row.trial_requires_payment_method,
    active: row.is_active,
    createdAt: row.created_at,
  }
}

export function normalizePlan(row: RawPlan): Plan {

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    tagline: row.tagline,
    active: row.is_active,
    public: row.is_public,
    recommended: row.is_recommended,
    badge: row.marketing_badge,
    sortOrder: row.sort_order,
    prices: (row.prices ?? []).map(normalizePrice),
    features: row.features ?? [],
    limits: row.limits ?? {},
  }
}

export function normalizeLimit(row: RawLimit): PlanLimit {
  return {
    key: row.limit_key,
    label: row.label,
    kind: row.kind,
    value: row.limit_value,
    configured: row.configured,
    unlimitedAllowed: row.unlimited_allowed,
  }
}

/** A feature the platform can put in a plan, from the admin `features` lookup. */
export type FeatureDefinition = { key: string; name: string; kind: string; section: string | null; requires: string[] }

function normalizeFeature(row: Record<string, unknown>): FeatureDefinition | null {
  if (typeof row.value !== "string" || typeof row.label !== "string") return null
  const meta = isRecord(row.meta) ? row.meta : {}
  return {
    key: row.value,
    name: row.label,
    kind: typeof meta.class === "string" ? meta.class : "module",
    section: typeof meta.section === "string" ? meta.section : null,
    requires: Array.isArray(meta.requires) ? meta.requires.filter((r): r is string => typeof r === "string") : [],
  }
}

export const planKeys = {
  all: ["plans"] as const,
  list: () => [...planKeys.all, "list"] as const,
  detail: (id: number) => [...planKeys.all, "detail", id] as const,
  limits: (id: number) => [...planKeys.all, "detail", id, "limits"] as const,
}

export const plansQuery = queryOptions({
  queryKey: planKeys.list(),
  queryFn: async ({ signal }) => (await unwrap(api.GET("/admin/plans", { signal }))).map(normalizePlan),
})

export const planQuery = (id: number) =>
  queryOptions({
    queryKey: planKeys.detail(id),
    queryFn: async ({ signal }) => normalizePlan(await unwrap(api.GET("/admin/plans/{plan}", { params: { path: { plan: id } }, signal }))),
  })

export const planLimitsQuery = (id: number) =>
  queryOptions({
    queryKey: planKeys.limits(id),
    queryFn: async ({ signal }) =>
      (await unwrap(api.GET("/admin/plans/{plan}/limits", { params: { path: { plan: id } }, signal }))).map(normalizeLimit),
  })

export const featureCatalogQuery = queryOptions({
  queryKey: ["lookup", "admin", "features"],
  queryFn: async ({ signal }) => {
    const rows = await unwrap(api.GET("/admin/lookups/{key}", { params: { path: { key: "features" } }, signal }))
    return (Array.isArray(rows) ? rows : [])
      .filter(isRecord)
      .map(normalizeFeature)
      .filter((f): f is FeatureDefinition => f !== null)
  },
  staleTime: 30 * 60_000,
})

/**
 * After a change: write what the response already tells us into the cache
 * so the screen updates at once, then refetch in the background (not
 * awaited, so dialogs close without waiting for it). Any plan change can
 * alter the list, the detail and the public pricing.
 */
function usePlanCache(id: number) {
  const client = useQueryClient()
  return {
    patch: (update: (plan: Plan) => Plan) => client.setQueryData<Plan>(planKeys.detail(id), (plan) => (plan ? update(plan) : plan)),
    setLimits: (limits: PlanLimit[]) => client.setQueryData(planKeys.limits(id), limits),
    refresh: () => void client.invalidateQueries({ queryKey: planKeys.all }),
  }
}

export function useCreatePlan() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (body: PlanBody & { name: string }) => normalizePlan(await unwrap(api.POST("/admin/plans", { body }))),
    onSuccess: (plan) => {
      client.setQueryData(planKeys.detail(plan.id), plan)
      void client.invalidateQueries({ queryKey: planKeys.list() })
    },
  })
}

export function useUpdatePlan(id: number) {
  const cache = usePlanCache(id)
  return useMutation({
    mutationFn: async (body: PlanBody) => normalizePlan(await unwrap(api.PATCH("/admin/plans/{plan}", { params: { path: { plan: id } }, body }))),
    onSuccess: (plan) => {
      cache.patch(() => plan)
      cache.refresh()
    },
  })
}

export function useDeactivatePlan(id: number) {
  const cache = usePlanCache(id)
  return useMutation({
    mutationFn: async () => normalizePlan(await unwrap(api.POST("/admin/plans/{plan}/deactivate", { params: { path: { plan: id } } }))),
    onSuccess: (plan) => {
      cache.patch(() => plan)
      cache.refresh()
    },
  })
}

export function useAddPrice(id: number) {
  const cache = usePlanCache(id)
  return useMutation({
    mutationFn: async (body: PriceBody) => normalizePrice(await unwrap(api.POST("/admin/plans/{plan}/prices", { params: { path: { plan: id } }, body }))),
    onSuccess: (price) => {
      // The new price retires the active one for the same currency and interval.
      cache.patch((plan) => ({
        ...plan,
        prices: [
          price,
          ...plan.prices.map((p) => (p.currency === price.currency && p.interval === price.interval ? { ...p, active: false } : p)),
        ],
      }))
      cache.refresh()
    },
  })
}

export function useUpdatePrice(id: number) {
  const cache = usePlanCache(id)
  return useMutation({
    mutationFn: async ({ priceId, body }: { priceId: number; body: PriceUpdateBody }) =>
      normalizePrice(await unwrap(api.PATCH("/admin/plans/{plan}/prices/{price}", { params: { path: { plan: id, price: priceId } }, body }))),
    onSuccess: (price) => {
      cache.patch((plan) => ({
        ...plan,
        prices: plan.prices.map((p) => {
          if (p.id === price.id) return price
          // Reactivating retires the other active price for the same currency and interval.
          return price.active && p.currency === price.currency && p.interval === price.interval ? { ...p, active: false } : p
        }),
      }))
      cache.refresh()
    },
  })
}

export function useToggleFeature(id: number) {
  const cache = usePlanCache(id)
  return useMutation({
    mutationFn: async ({ key, on }: { key: string; on: boolean }) => {
      if (on) await unwrap(api.POST("/admin/plans/{plan}/features", { params: { path: { plan: id } }, body: { feature_key: key } }))
      else await unwrap(api.DELETE("/admin/plans/{plan}/features/{featureKey}", { params: { path: { plan: id, featureKey: key } } }))
    },
    onSuccess: (_result, { key, on }) => {
      cache.patch((plan) => ({ ...plan, features: on ? [...new Set([...plan.features, key])] : plan.features.filter((f) => f !== key) }))
      cache.refresh()
    },
  })
}

export function useSetLimit(id: number) {
  const cache = usePlanCache(id)
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: number | null }) =>
      (await unwrap(api.POST("/admin/plans/{plan}/limits", { params: { path: { plan: id } }, body: { limit_key: key, limit_value: value } }))).map(normalizeLimit),
    onSuccess: (limits) => {
      cache.setLimits(limits)
      cache.refresh()
    },
  })
}

export const INTERVAL_LABELS: Record<PlanPrice["interval"], string> = { monthly: "Monthly", yearly: "Yearly" }
export const FEATURE_KIND_LABELS: Record<string, string> = { module: "Modules", capability: "Capabilities", integration: "Integrations" }
