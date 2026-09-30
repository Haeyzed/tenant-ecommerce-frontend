import { Readable } from "node:stream"
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web"

import { request } from "undici"

import type { BffConfig } from "./config"
import { upstreamUnavailable } from "./envelope"

/** Per-request client identity forwarded to Laravel (spec §8.3). */
export type RequestContext = {
  apiHost: string
  clientIp: string | null
  userAgent: string | null
  acceptLanguage: string | null
  requestId: string
}

export type UpstreamInit = {
  method: string
  /** "/api/admin/products" */
  path: string
  /** "?page=2" or "" */
  search?: string
  body?: ReadableStream<Uint8Array> | string | null
  /** Only Content-Type and Idempotency-Key are forwarded. */
  headers?: Headers
  token?: string | null
  guestToken?: string | null
  timeoutMs?: number
}

/** Response headers passed back to the browser (spec §8.3). */
const RESPONSE_HEADERS = [
  "content-type",
  "content-disposition",
  "content-length",
  "retry-after",
  "x-request-id",
  "x-module-notice",
  "idempotent-replayed",
  "location",
]

/** Builds the context from the incoming request's headers; the edge sets X-Real-IP and X-Request-Id. */
export function requestContext(
  headers: Headers,
  apiHost: string
): RequestContext {
  return {
    apiHost,
    clientIp: headers.get("x-real-ip"),
    userAgent: headers.get("user-agent"),
    acceptLanguage: headers.get("accept-language"),
    requestId: headers.get("x-request-id") ?? crypto.randomUUID(),
  }
}

/**
 * Calls Laravel on its private address with the tenant or landlord Host.
 * A timeout or network failure becomes 502 upstream_unavailable.
 */
export async function upstream(
  ctx: RequestContext,
  init: UpstreamInit,
  config: Pick<BffConfig, "laravelUrl">
): Promise<Response> {
  const headers: Record<string, string> = {
    host: ctx.apiHost,
    accept: "application/json",
    "x-forwarded-proto": "https",
    "x-request-id": ctx.requestId,
  }

  if (ctx.clientIp) {
    headers["x-forwarded-for"] = ctx.clientIp
    headers["x-real-ip"] = ctx.clientIp
  }
  if (ctx.userAgent) headers["user-agent"] = ctx.userAgent
  if (ctx.acceptLanguage) headers["accept-language"] = ctx.acceptLanguage
  if (init.token) headers.authorization = `Bearer ${init.token}`
  if (init.guestToken) headers["x-guest-token"] = init.guestToken

  const contentType = init.headers?.get("content-type")
  const idempotencyKey = init.headers?.get("idempotency-key")
  if (contentType) headers["content-type"] = contentType
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey

  const timeoutMs = init.timeoutMs ?? 30_000
  const body =
    init.body == null
      ? null
      : typeof init.body === "string"
        ? init.body
        : Readable.fromWeb(
            init.body as unknown as NodeWebReadableStream<Uint8Array>
          )

  try {
    const response = await request(
      `${config.laravelUrl}${init.path}${init.search ?? ""}`,
      {
        method: init.method as "GET",
        headers,
        body,
        headersTimeout: timeoutMs,
        bodyTimeout: timeoutMs,
        signal: AbortSignal.timeout(timeoutMs),
      }
    )

    const outHeaders = new Headers()
    for (const name of RESPONSE_HEADERS) {
      const value = response.headers[name]
      if (typeof value === "string") outHeaders.set(name, value)
    }

    const noBody =
      response.statusCode === 204 ||
      response.statusCode === 304 ||
      init.method === "HEAD"
    const stream = noBody
      ? null
      : (Readable.toWeb(response.body) as unknown as ReadableStream<Uint8Array>)

    if (noBody) await response.body.dump()

    return new Response(stream, {
      status: response.statusCode,
      headers: outHeaders,
    })
  } catch {
    return upstreamUnavailable()
  }
}

/** Reads a JSON body from an upstream response without throwing; null for non-JSON. */
export async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}
