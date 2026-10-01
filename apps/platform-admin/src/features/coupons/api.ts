"use client"

import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"

import { normalizeKpis } from "@workspace/admin-kit/dashboard"
import { unwrap, unwrapPage } from "@workspace/api-client"
import type { components, operations } from "@workspace/contract/landlord"

import { api } from "@/shell/api-client"

export type Coupon = components["schemas"]["PlatformCouponResource"]
export type CouponBody = operations["landlord.billing.platform-coupons.store"]["requestBody"]["content"]["application/json"]
export type CouponFilters = NonNullable<operations["landlord.billing.platform-coupons.index"]["parameters"]["query"]>

export const COUPON_PERIODS = ["scheduled", "running", "ended"] as const

export const couponKeys = {
  all: ["platform-coupons"] as const,
  list: (filters: CouponFilters) => [...couponKeys.all, "list", filters] as const,
  detail: (id: number) => [...couponKeys.all, "detail", id] as const,
  redemptions: (id: number, page: number) => [...couponKeys.all, "detail", id, "redemptions", page] as const,
  metrics: () => [...couponKeys.all, "metrics"] as const,
}

export const couponsQuery = (filters: CouponFilters) =>
  queryOptions({
    queryKey: couponKeys.list(filters),
    queryFn: ({ signal }) => unwrapPage(api.GET("/admin/platform-coupons", { params: { query: filters }, signal })),
  })

export const couponQuery = (id: number) =>
  queryOptions({
    queryKey: couponKeys.detail(id),
    queryFn: ({ signal }) => unwrap(api.GET("/admin/platform-coupons/{coupon}", { params: { path: { coupon: id } }, signal })),
  })

export const redemptionsQuery = (id: number, page: number) =>
  queryOptions({
    queryKey: couponKeys.redemptions(id, page),
    queryFn: ({ signal }) =>
      unwrapPage(api.GET("/admin/platform-coupons/{coupon}/redemptions", { params: { path: { coupon: id }, query: { page, per_page: 10 } }, signal })),
  })

export const couponMetricsQuery = queryOptions({
  queryKey: couponKeys.metrics(),
  queryFn: async ({ signal }) => normalizeKpis(await unwrap(api.GET("/admin/platform-coupons/metrics", { signal }))),
  staleTime: 2 * 60_000,
})

/**
 * Create or update. The generated response type of these routes is unusable
 * (`Resource & Record<string, never>`), so only the coupon id is read, with
 * a runtime check.
 */
export function useSaveCoupon(id: number | null) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (body: CouponBody): Promise<{ id: number }> => {
      const saved: unknown =
        id === null
          ? await unwrap(api.POST("/admin/platform-coupons", { body }))
          : await unwrap(api.PATCH("/admin/platform-coupons/{coupon}", { params: { path: { coupon: id } }, body }))
      const savedId = typeof saved === "object" && saved !== null && "id" in saved && typeof saved.id === "number" ? saved.id : id
      if (savedId === null) throw new Error("The coupon was saved but its id was not returned.")
      return { id: savedId }
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: couponKeys.all }),
  })
}

export function useDeactivateCoupon(id: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async () => unwrap(api.POST("/admin/platform-coupons/{coupon}/deactivate", { params: { path: { coupon: id } } })),
    onSuccess: () => void client.invalidateQueries({ queryKey: couponKeys.all }),
  })
}

/** Where a coupon stands now, from its switch and its dates. */
export function couponState(coupon: Coupon): "inactive" | "scheduled" | "ended" | "running" {
  const now = Date.now()
  if (!coupon.is_active) return "inactive"
  if (coupon.starts_at && Date.parse(coupon.starts_at) > now) return "scheduled"
  if (coupon.ends_at && Date.parse(coupon.ends_at) <= now) return "ended"
  return "running"
}

/** "20% off", "$5.00 off", with the duration. */
export function discountText(coupon: Pick<Coupon, "discount_type" | "discount_value" | "currency_code" | "duration" | "duration_cycles">, money: (amount: string, currency: string | null) => string): string {
  const off = coupon.discount_type === "percentage" ? `${Number(coupon.discount_value)}% off` : `${money(coupon.discount_value, coupon.currency_code)} off`
  return coupon.duration === "repeating" ? `${off} for ${coupon.duration_cycles ?? "?"} payments` : `${off} the first payment`
}
