/** Frontend-only error envelopes the BFF answers with (spec §8.3, §8.6, §12.4). */
export function errorEnvelope(status: number, code: string, message: string, extraHeaders: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({ success: false, message, data: null, meta: { error_code: code, details: {} }, errors: {} }),
    { status, headers: { "Content-Type": "application/json", ...extraHeaders } },
  )
}

export const notFound = () => errorEnvelope(404, "not_found", "The requested resource was not found.")
export const upstreamUnavailable = () => errorEnvelope(502, "upstream_unavailable", "The service is temporarily unavailable.")
export const csrfRejected = () => errorEnvelope(403, "csrf_rejected", "This request was blocked for your security. Reload the page and try again.")
export const unauthenticated = () => errorEnvelope(401, "unauthenticated", "Your session has ended. Sign in again.")
