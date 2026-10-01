"use client"

import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"

import { unwrap } from "@workspace/api-client"
import type { operations } from "@workspace/contract/landlord"

import { api } from "@/shell/api-client"

type IndexData = operations["landlord.billing.payment-gateways.index"]["responses"][200]["content"]["application/json"]["data"]
type RawGateway = IndexData["gateways"][number]
export type GatewayBody = NonNullable<operations["landlord.billing.payment-gateways.update"]["requestBody"]>["content"]["application/json"]
export type TestResult = operations["landlord.billing.payment-gateways.test"]["responses"][200]["content"]["application/json"]["data"]

export const PROVIDERS = ["paystack", "flutterwave", "stripe"] as const
export type Provider = (typeof PROVIDERS)[number]
export type Mode = "test" | "live"

export const PROVIDER_LABELS: Record<Provider, string> = { paystack: "Paystack", flutterwave: "Flutterwave", stripe: "Stripe" }

/**
 * How each provider signs its webhooks (the backend's gateway drivers).
 * Paystack signs with the secret key, so it needs no separate secret.
 */
export const WEBHOOK_SECRET_HINT: Record<Provider, string | null> = {
  paystack: null,
  flutterwave: "The secret hash set under Settings → Webhooks in the Flutterwave dashboard.",
  stripe: "The signing secret (whsec_…) of this webhook endpoint in the Stripe dashboard.",
}

/**
 * One provider's credentials in one mode (spec §15.10). Secrets are
 * write-only: the API returns only whether they are stored.
 * @source App\Modules\Billing\Services\PlatformPaymentGatewayService::present
 */
export type Gateway = {
  provider: Provider
  mode: Mode
  configured: boolean
  publicKey: string | null
  hasSecretKey: boolean
  hasWebhookSecret: boolean
  enabled: boolean
  isDefault: boolean
  sortOrder: number
  currencies: string[]
  countryIds: number[] | null
  verifiedAt: string | null
  lastWebhookAt: string | null
  webhookUrl: string
}

const isProvider = (v: string): v is Provider => PROVIDERS.some((p) => p === v)

export function normalizeGateway(row: RawGateway): Gateway | null {
  if (!isProvider(row.provider) || (row.mode !== "test" && row.mode !== "live")) return null
  return {
    provider: row.provider,
    mode: row.mode,
    configured: row.configured,
    publicKey: row.public_key,
    hasSecretKey: row.has_secret_key,
    hasWebhookSecret: row.has_webhook_secret,
    enabled: row.is_enabled,
    isDefault: row.is_default,
    sortOrder: row.sort_order,
    currencies: row.supported_currencies,
    countryIds: row.supported_country_ids,
    verifiedAt: row.credentials_verified_at,
    lastWebhookAt: row.last_webhook_at,
    webhookUrl: row.webhook_url,
  }
}

export const gatewaysQuery = queryOptions({
  queryKey: ["payment-gateways"],
  queryFn: async ({ signal }) => {
    const data = await unwrap(api.GET("/admin/payment-gateways", { signal }))
    const billingMode: Mode = data.billing_payment_mode === "live" ? "live" : "test"
    return {
      billingMode,
      gateways: data.gateways
        .map(normalizeGateway)
        .filter((g): g is Gateway => g !== null)
        .sort((a, b) => PROVIDERS.indexOf(a.provider) - PROVIDERS.indexOf(b.provider)),
    }
  },
})

/** Verified credentials stay usable for enabling for 24 hours (the backend's rule). */
export function isFreshlyVerified(gateway: Gateway): boolean {
  return gateway.verifiedAt !== null && Date.now() - Date.parse(gateway.verifiedAt) < 24 * 60 * 60_000
}

type Target = { provider: Provider; mode: Mode }
const path = (t: Target) => ({ params: { path: { provider: t.provider, mode: t.mode } } })

type GatewaysData = { billingMode: Mode; gateways: Gateway[] }

/**
 * After a change: put the returned row into the cache so the card updates at
 * once, then refetch in the background (not awaited, so the sheet and
 * dialogs close without waiting for it).
 */
function useGatewayCache() {
  const client = useQueryClient()
  return {
    put: (row: RawGateway | null) => {
      const gateway = row ? normalizeGateway(row) : null
      if (gateway === null) return
      client.setQueryData<GatewaysData>(gatewaysQuery.queryKey, (data) =>
        data
          ? {
              ...data,
              gateways: data.gateways.map((g) => {
                if (g.provider === gateway.provider && g.mode === gateway.mode) return gateway
                // A new default replaces the old one in the same mode.
                return gateway.isDefault && g.mode === gateway.mode ? { ...g, isDefault: false } : g
              }),
            }
          : data
      )
    },
    setMode: (mode: Mode) => client.setQueryData<GatewaysData>(gatewaysQuery.queryKey, (data) => (data ? { ...data, billingMode: mode } : data)),
    refresh: () => void client.invalidateQueries({ queryKey: gatewaysQuery.queryKey }),
  }
}

export function useSaveGateway() {
  const cache = useGatewayCache()
  return useMutation({
    mutationFn: async ({ body, ...target }: Target & { body: GatewayBody }) =>
      unwrap(api.PUT("/admin/payment-gateways/{provider}/{mode}", { ...path(target), body })),
    onSuccess: (row) => {
      cache.put(row)
      cache.refresh()
    },
  })
}

export function useTestGateway() {
  const cache = useGatewayCache()
  return useMutation({
    mutationFn: async (target: Target) => unwrap(api.POST("/admin/payment-gateways/{provider}/{mode}/test", path(target))),
    // The test returns a verdict, not the row; the refetch brings the new verified time.
    onSuccess: () => cache.refresh(),
  })
}

export function useGatewayAction() {
  const cache = useGatewayCache()
  return useMutation({
    mutationFn: async ({ action, ...target }: Target & { action: "enable" | "disable" | "set-default" }) => {
      switch (action) {
        case "enable":
          return unwrap(api.POST("/admin/payment-gateways/{provider}/{mode}/enable", path(target)))
        case "disable":
          return unwrap(api.POST("/admin/payment-gateways/{provider}/{mode}/disable", path(target)))
        case "set-default":
          return unwrap(api.POST("/admin/payment-gateways/{provider}/{mode}/set-default", path(target)))
      }
    },
    onSuccess: (row) => {
      cache.put(row)
      cache.refresh()
    },
  })
}

export function useSetBillingMode() {
  const cache = useGatewayCache()
  return useMutation({
    mutationFn: async (body: { mode: Mode; reason: string }) =>
      unwrap(api.POST("/admin/payment-gateways/mode", { body: { ...body, confirm: true } })),
    onSuccess: (_data, body) => {
      cache.setMode(body.mode)
      cache.refresh()
    },
  })
}
