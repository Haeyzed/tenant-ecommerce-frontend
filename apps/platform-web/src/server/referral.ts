import "server-only"

import { createLandlordClient, isApiError, unwrap } from "@workspace/api-client"
import {
  cookieName,
  cookieOptions,
  decodeReferral,
  encodeReferral,
  passesCsrf,
  readCookie,
  serializeCookie,
  withReferralToken as addReferralToken,
  type Referral,
} from "@workspace/bff"

import { publicBff } from "@/server/bff"

/**
 * Affiliate referral capture (spec §24.4). The click's signed token and the
 * visitor id live in an HttpOnly cookie; the browser never reads them, and
 * the BFF adds the token to `POST /api/register` itself.
 */
const COOKIE = cookieName("ref", { secureCookies: true })
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const

function referralFrom(request: Request): Referral | null {
  return decodeReferral(readCookie(request.headers.get("cookie"), COOKIE))
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0 ? value.slice(0, max) : null
}

const json = (status: number, body: unknown, setCookie?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...(setCookie ? { "set-cookie": setCookie } : {}) },
  })

/** `POST /bff/affiliate-clicks`: records the click and stores the token. Answers without the token. */
export async function recordClick(request: Request): Promise<Response> {
  if (!passesCsrf(request)) return json(403, { success: false, message: "Request rejected.", meta: { error_code: "csrf_rejected" } })

  const server = publicBff.server(request.headers)
  if (server === null) return json(404, { success: false, message: "Not found.", meta: { error_code: "not_found" } })

  let input: unknown
  try {
    input = await request.json()
  } catch {
    input = null
  }
  const body = typeof input === "object" && input !== null ? input : {}
  const field = (key: string, max: number) => text(key in body ? Reflect.get(body, key) : null, max)

  const code = field("code", 64)
  if (!code) return json(422, { success: false, message: "A referral code is required.", meta: { error_code: "validation_failed" } })

  const client = createLandlordClient({ baseUrl: "http://upstream", fetch: server.fetch })
  try {
    const result = await unwrap(
      client.POST("/affiliate-clicks", {
        body: {
          code,
          visitor_id: referralFrom(request)?.visitorId ?? null,
          landing_path: field("landing_path", 2048),
          referrer: field("referrer", 2048),
          ...Object.fromEntries(UTM_KEYS.map((key) => [key, field(key, 255)])),
        },
      })
    )

    const expiresAt = Math.floor(new Date(result.expires_at).getTime() / 1000)
    const value = encodeReferral({ token: result.referral_token, visitorId: result.visitor_id })
    return json(200, { success: true, message: "OK", data: { captured: true } }, serializeCookie(COOKIE, value, cookieOptions({ secureCookies: true }, expiresAt)))
  } catch (error) {
    // An unknown code or a paused programme is not the visitor's problem: nothing is stored.
    return json(isApiError(error) ? error.status : 502, {
      success: false,
      message: "Referral not recorded.",
      meta: { error_code: isApiError(error) ? error.code : "upstream_unavailable" },
    })
  }
}

/** `POST /api/register` with the cookie's `referral_token` added (§24.4 step 2); anything else unchanged. */
export function withReferralToken(request: Request, path: readonly string[]): Promise<Request> {
  return addReferralToken(request, path, referralFrom(request))
}
