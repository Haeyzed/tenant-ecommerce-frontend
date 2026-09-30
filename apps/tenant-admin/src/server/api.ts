import "server-only"

import { headers } from "next/headers"
import { cache } from "react"

import { ApiError, createTenantClient, unwrap } from "@workspace/api-client"

import { normalizeMe, type StaffSession } from "@/features/session/me"
import { staffBff } from "@/server/bff"

/**
 * The server-side API client for this request: calls Laravel directly
 * through upstream() with the staff session (spec §8.1, §12.2).
 */
export const getServerContext = cache(async () => {
  const server = await staffBff.server(await headers())
  if (server === null) return null

  const client = createTenantClient({
    baseUrl: "http://upstream",
    fetch: server.fetch,
  })
  return { ...server, client }
})

export type StoreBranding = {
  name: string
  logoUrl: string | null
  currency: string
}

/**
 * The store's public name and logo for the login and shell, from the
 * storefront config. Null when the host is not a store (404) or the API
 * cannot be reached; callers render "Store not found" or a neutral page.
 */
export const loadStoreBranding = cache(
  async (): Promise<
    | { kind: "ok"; branding: StoreBranding }
    | { kind: "not-found" }
    | { kind: "error"; error: ApiError }
  > => {
    const ctx = await getServerContext()
    if (ctx === null) return { kind: "not-found" }

    try {
      const config = await unwrap(ctx.client.GET("/storefront/config"))
      const name =
        typeof config.business.store_name === "string" &&
        config.business.store_name !== ""
          ? config.business.store_name
          : ctx.tenant.kind === "tenant" && ctx.tenant.slug
            ? ctx.tenant.slug
            : "Your store"
      const base = config.formatting.currencies.find(
        (c) => c.is_base
      )?.currency_code
      const currency =
        base ??
        (typeof config.formatting.default_currency === "string"
          ? config.formatting.default_currency
          : "USD")
      return {
        kind: "ok",
        branding: { name, logoUrl: config.business.logo_url, currency },
      }
    } catch (error) {
      if (error instanceof ApiError)
        return error.status === 404
          ? { kind: "not-found" }
          : { kind: "error", error }
      throw error
    }
  }
)

export type SessionResult =
  | { kind: "ok"; session: StaffSession }
  | { kind: "anonymous" }
  | { kind: "unknown-host" }
  | { kind: "error"; error: ApiError }

/** Loads `me` once per request; the layout decides what to render from the result. */
export const loadStaffSession = cache(async (): Promise<SessionResult> => {
  const ctx = await getServerContext()
  if (ctx === null) return { kind: "unknown-host" }
  if (ctx.session === null) return { kind: "anonymous" }

  try {
    return {
      kind: "ok",
      session: normalizeMe(await unwrap(ctx.client.GET("/admin/auth/me"))),
    }
  } catch (error) {
    if (error instanceof ApiError) {
      return error.status === 401
        ? { kind: "anonymous" }
        : { kind: "error", error }
    }
    throw error
  }
})
