/**
 * The affiliate referral cookie (spec §24.4): the click's signed token and
 * the visitor id, base64url JSON in an HttpOnly cookie that only the BFF reads.
 */
export type Referral = { token: string; visitorId: string }

export function encodeReferral(referral: Referral): string {
  return Buffer.from(JSON.stringify({ t: referral.token, v: referral.visitorId })).toString("base64url")
}

export function decodeReferral(value: string | undefined): Referral | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
    if (typeof parsed !== "object" || parsed === null || !("t" in parsed) || !("v" in parsed)) return null
    const { t, v } = parsed
    return typeof t === "string" && typeof v === "string" && t.length > 0 ? { token: t, visitorId: v } : null
  } catch {
    return null
  }
}

/**
 * `POST /api/register` with `referral_token` added from the referral
 * (§24.4 step 2). Any other request, or a body that isn't a JSON object,
 * passes through unchanged.
 */
export async function withReferralToken(request: Request, path: readonly string[], referral: Referral | null): Promise<Request> {
  if (referral === null || request.method !== "POST" || path.length !== 1 || path[0] !== "register") return request

  let body: unknown
  try {
    body = await request.clone().json()
  } catch {
    return request
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return request

  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify({ ...body, referral_token: referral.token }),
  })
}
