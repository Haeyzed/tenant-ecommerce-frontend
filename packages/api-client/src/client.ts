import createClient, { type Middleware } from "openapi-fetch"

import type { paths as LandlordPaths } from "@workspace/contract/landlord"
import type { paths as TenantPaths } from "@workspace/contract/tenant"

import { serializeQuery } from "./query"

export type ClientOptions = {
  /** Browser: the BFF prefix plus /api, e.g. "/bff/staff/api". Server: any base; `fetch` is bound to upstream(). */
  baseUrl: string
  fetch?: (request: Request) => Promise<Response>
  middleware?: Middleware[]
  /** Browser clients send the CSRF marker the BFF requires on writes (spec §8.6). */
  browser?: boolean
}

const requestId: Middleware = {
  onRequest({ request }) {
    if (!request.headers.has("X-Request-Id")) {
      request.headers.set("X-Request-Id", crypto.randomUUID())
    }
    return request
  },
}

const csrf: Middleware = {
  onRequest({ request }) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      request.headers.set("X-Requested-With", "bff")
    }
    return request
  },
}

const acceptJson: Middleware = {
  onRequest({ request }) {
    request.headers.set("Accept", "application/json")
    return request
  },
}

function build<Paths extends {}>(options: ClientOptions) {
  const client = createClient<Paths>({
    baseUrl: options.baseUrl,
    querySerializer: (query) => serializeQuery(query as Record<string, unknown>),
    ...(options.fetch ? { fetch: options.fetch } : {}),
  })

  client.use(requestId, acceptJson, ...(options.browser ? [csrf] : []), ...(options.middleware ?? []))

  return client
}

export function createTenantClient(options: ClientOptions) {
  return build<TenantPaths>(options)
}

export function createLandlordClient(options: ClientOptions) {
  return build<LandlordPaths>(options)
}

export type TenantClient = ReturnType<typeof createTenantClient>
export type LandlordClient = ReturnType<typeof createLandlordClient>
export type { Middleware }
