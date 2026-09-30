import "server-only"

import { headers } from "next/headers"
import { cache } from "react"

import { createLandlordClient, unwrap } from "@workspace/api-client"

import {
  normalizePlans,
  normalizePlatformConfig,
  type LegalDocument,
  type Plan,
  type PlatformConfig,
} from "@/features/signup/model"
import { publicBff } from "@/server/bff"

/** The server-side landlord client for this request (spec §12.2). No session, no token. */
const getClient = cache(async () => {
  const server = publicBff.server(await headers())
  if (server === null) throw new Error("platform-web could not resolve the landlord host.")
  return createLandlordClient({ baseUrl: "http://upstream", fetch: server.fetch })
})

/** Public plans with their prices, features and limits (spec §24.1). */
export const loadPlans = cache(async (currency?: string): Promise<Plan[]> => {
  const client = await getClient()
  const query = currency ? { currency } : {}
  return normalizePlans(await unwrap(client.GET("/plans", { params: { query } })))
})

/** The current published legal documents; the signup form asks for the required ones. */
export const loadLegalDocuments = cache(async (): Promise<LegalDocument[]> => {
  const client = await getClient()
  return unwrap(client.GET("/legal-documents/current"))
})

/** The platform's public name, logo and sign-up switch. Falls back rather than failing the page. */
export const loadPlatformConfig = cache(async (): Promise<PlatformConfig> => {
  try {
    const client = await getClient()
    return normalizePlatformConfig(await unwrap(client.GET("/platform/config")))
  } catch {
    return normalizePlatformConfig(null)
  }
})
