import type { AllowRule, BffConfig } from "./config"
import { csrfRejected, notFound } from "./envelope"
import { passesCsrf } from "./csrf"
import { isAllowed, normalizeUpstreamPath } from "./paths"
import { resolveTenantContext } from "./tenant"
import { requestContext, upstream } from "./upstream"

/**
 * A proxy for apps without a session (platform-web, spec §8.5): same
 * allow-list, path normalisation and CSRF rules as the session proxy, but
 * no cookie and no token is ever attached.
 */
export function createPublicProxy(options: { config: BffConfig; allow: readonly AllowRule[] }) {
  const { config } = options

  async function proxy(request: Request, segments: readonly string[]): Promise<Response> {
    if (!passesCsrf(request)) return csrfRejected()

    const tenant = resolveTenantContext(request.headers.get("host"), config)
    const path = normalizeUpstreamPath(segments)
    if (tenant === null || path === null || !isAllowed(options.allow, request.method, path)) return notFound()

    return upstream(
      requestContext(request.headers, tenant.apiHost),
      {
        method: request.method,
        path,
        search: new URL(request.url).search,
        body: request.method === "GET" || request.method === "HEAD" ? null : request.body,
        headers: request.headers,
      },
      config
    )
  }

  /** Server Components: a fetch bound to upstream() without a session. */
  function server(requestHeaders: Headers) {
    const tenant = resolveTenantContext(requestHeaders.get("host"), config)
    if (tenant === null) return null

    const ctx = requestContext(requestHeaders, tenant.apiHost)
    const fetchUpstream = async (req: Request): Promise<Response> => {
      const url = new URL(req.url)
      const body = req.method === "GET" || req.method === "HEAD" ? null : await req.text()
      return upstream(ctx, { method: req.method, path: `/api${url.pathname}`, search: url.search, body, headers: req.headers }, config)
    }

    return { tenant, fetch: fetchUpstream }
  }

  return { proxy, server }
}

export type PublicProxy = ReturnType<typeof createPublicProxy>
