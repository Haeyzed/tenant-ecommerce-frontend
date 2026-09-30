import "server-only"

import { headers } from "next/headers"
import { cache } from "react"

import { ApiError, createLandlordClient, unwrap } from "@workspace/api-client"

import { normalizeMe, type PlatformSession } from "@/features/session/me"
import { platformBff } from "@/server/bff"

/** The server-side landlord client for this request (spec §8.1, §12.2). */
export const getServerContext = cache(async () => {
  const server = await platformBff.server(await headers())
  if (server === null) return null

  const client = createLandlordClient({ baseUrl: "http://upstream", fetch: server.fetch })
  return { ...server, client }
})

export type PlatformBranding = { name: string; logoUrl: string | null }

/** The platform's name and logo from the public config (for the login page and shell). */
export const loadBranding = cache(async (): Promise<PlatformBranding> => {
  const ctx = await getServerContext()
  const fallback = { name: "Platform admin", logoUrl: null }
  if (ctx === null) return fallback

  try {
    const config = (await unwrap(ctx.client.GET("/platform/config"))) as Record<string, unknown>
    return {
      name: typeof config.platform_name === "string" && config.platform_name ? config.platform_name : fallback.name,
      logoUrl: typeof config.platform_logo_url === "string" ? config.platform_logo_url : null,
    }
  } catch {
    return fallback
  }
})

export type SessionResult =
  | { kind: "ok"; session: PlatformSession }
  | { kind: "anonymous" }
  | { kind: "error"; error: ApiError }

/** Loads `me` once per request; the console layout decides what to render. */
export const loadPlatformSession = cache(async (): Promise<SessionResult> => {
  const ctx = await getServerContext()
  if (ctx === null || ctx.session === null) return { kind: "anonymous" }

  try {
    return { kind: "ok", session: normalizeMe(await unwrap(ctx.client.GET("/admin/auth/me"))) }
  } catch (error) {
    if (error instanceof ApiError) return error.status === 401 ? { kind: "anonymous" } : { kind: "error", error }
    throw error
  }
})
