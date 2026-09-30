import type { Actor, AllowRule, BffConfig } from "./config"
import {
  clearCookie,
  cookieOptions,
  readCookie,
  serializeCookie,
  sessionCookieName,
} from "./cookies"
import {
  csrfRejected,
  errorEnvelope,
  notFound,
  unauthenticated,
} from "./envelope"
import { isAllowed, normalizeUpstreamPath, safeNext } from "./paths"
import {
  isSessionValid,
  sealSession,
  sessionFromLogin,
  unsealSession,
  type SealedSession,
} from "./session"
import { resolveTenantContext } from "./tenant"
import { readJson, requestContext, upstream } from "./upstream"

export type BffOptions = {
  config: BffConfig
  actor: Actor
  /** Upstream paths this app may reach through the proxy (spec §8.5). */
  allow: readonly AllowRule[]
  /** The actor's upstream auth routes. */
  auth: {
    login: string
    logout: string
    refresh?: string
  }
  /** The app's login page, for expired-session redirects. */
  loginPath: string
}

type JsonRecord = Record<string, unknown>

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  })

/** The app's own origin as the browser sees it, from the Host the edge preserved. */
function ownOrigin(request: Request): string | null {
  const host = request.headers.get("host")
  if (!host) return null
  const proto =
    request.headers.get("x-forwarded-proto") ??
    new URL(request.url).protocol.replace(":", "")
  return `${proto}://${host}`
}

/** Non-GET BFF requests need the app's Origin and X-Requested-With: bff (spec §8.6). */
function passesCsrf(request: Request): boolean {
  if (request.method === "GET" || request.method === "HEAD") return true
  const origin = request.headers.get("origin")
  return (
    origin !== null &&
    origin === ownOrigin(request) &&
    request.headers.get("x-requested-with") === "bff"
  )
}

export function createBff(options: BffOptions) {
  const { config, actor } = options
  const cookie = sessionCookieName(actor, config)

  function context(request: Request) {
    const tenant = resolveTenantContext(request.headers.get("host"), config)
    return tenant === null
      ? null
      : requestContext(request.headers, tenant.apiHost)
  }

  async function currentSession(
    request: Request,
    apiHost: string
  ): Promise<SealedSession | null> {
    const session = await unsealSession(
      readCookie(request.headers.get("cookie"), cookie),
      config
    )
    return isSessionValid(session, actor, apiHost) ? session : null
  }

  async function withSessionCookie(
    response: Response,
    session: SealedSession
  ): Promise<Response> {
    response.headers.append(
      "Set-Cookie",
      serializeCookie(
        cookie,
        await sealSession(session, config),
        cookieOptions(config, session.expiresAt)
      )
    )
    return response
  }

  function withClearedCookie(response: Response): Response {
    response.headers.append("Set-Cookie", clearCookie(cookie, config))
    return response
  }

  /** `/bff/.../api/[...path]`: the authenticated proxy (spec §8.3, §8.5). */
  async function proxy(
    request: Request,
    segments: readonly string[]
  ): Promise<Response> {
    if (!passesCsrf(request)) return csrfRejected()

    const ctx = context(request)
    const path = normalizeUpstreamPath(segments)
    if (
      ctx === null ||
      path === null ||
      !isAllowed(options.allow, request.method, path)
    )
      return notFound()

    const session = await currentSession(request, ctx.apiHost)
    if (session === null) {
      return request.headers.get("cookie")?.includes(cookie)
        ? withClearedCookie(unauthenticated())
        : unauthenticated()
    }

    const response = await upstream(
      ctx,
      {
        method: request.method,
        path,
        search: new URL(request.url).search,
        body:
          request.method === "GET" || request.method === "HEAD"
            ? null
            : request.body,
        headers: request.headers,
        token: session.token,
        timeoutMs: (request.headers.get("content-type") ?? "").startsWith(
          "multipart/"
        )
          ? 120_000
          : 30_000,
      },
      config
    )

    // A token Laravel no longer accepts clears the cookie (spec §8.3).
    return response.status === 401 ? withClearedCookie(response) : response
  }

  /** Seals the token of a login or refresh response and removes it from the body (spec §8.4). */
  async function sealFromAuthResponse(
    response: Response,
    apiHost: string
  ): Promise<Response> {
    const body = await readJson(response)

    if (
      !response.ok ||
      !isRecord(body) ||
      !isRecord(body.data) ||
      typeof body.data.token !== "string"
    ) {
      return json(
        body ?? {
          success: false,
          message: "The service is temporarily unavailable.",
          data: null,
          meta: { error_code: "upstream_unavailable", details: {} },
          errors: {},
        },
        response.ok ? 502 : response.status,
        retryHeaders(response)
      )
    }

    const data = body.data as JsonRecord & {
      token: string
      expires_at?: string | null
    }
    const session = sessionFromLogin(actor, apiHost, data, config)
    const { token: _token, token_type: _type, ...rest } = data

    return withSessionCookie(
      json({
        ...body,
        data: {
          ...rest,
          expires_at: new Date(session.expiresAt * 1000).toISOString(),
        },
      }),
      session
    )
  }

  function retryHeaders(response: Response): HeadersInit {
    const retryAfter = response.headers.get("retry-after")
    return retryAfter ? { "Retry-After": retryAfter } : {}
  }

  /** `/bff/auth/login`: `{email, password}` (spec §9.2). */
  async function login(request: Request): Promise<Response> {
    if (!passesCsrf(request)) return csrfRejected()

    const ctx = context(request)
    if (ctx === null) return notFound()

    const input = await request.json().catch(() => null)
    if (
      !isRecord(input) ||
      typeof input.email !== "string" ||
      typeof input.password !== "string"
    ) {
      return errorEnvelope(
        422,
        "validation_failed",
        "Enter your email and password."
      )
    }

    const body = JSON.stringify({
      email: input.email.slice(0, 255),
      password: input.password.slice(0, 255),
      device_name: (ctx.userAgent ?? "web").slice(0, 100),
    })

    const response = await upstream(
      ctx,
      {
        method: "POST",
        path: options.auth.login,
        body,
        headers: new Headers({ "content-type": "application/json" }),
      },
      config
    )
    return sealFromAuthResponse(response, ctx.apiHost)
  }

  /** `/bff/auth/refresh`: swaps the token for a new one (spec §9.3). */
  async function refresh(request: Request): Promise<Response> {
    if (!passesCsrf(request)) return csrfRejected()

    const ctx = context(request)
    if (ctx === null || !options.auth.refresh) return notFound()

    const session = await currentSession(request, ctx.apiHost)
    if (session === null) return withClearedCookie(unauthenticated())

    const response = await upstream(
      ctx,
      { method: "POST", path: options.auth.refresh, token: session.token },
      config
    )
    if (response.status === 401) return withClearedCookie(unauthenticated())

    return sealFromAuthResponse(response, ctx.apiHost)
  }

  /** `/bff/auth/logout`: best-effort upstream logout, then always clear (spec §9.6). */
  async function logout(request: Request): Promise<Response> {
    if (!passesCsrf(request)) return csrfRejected()

    const ctx = context(request)
    const session =
      ctx === null ? null : await currentSession(request, ctx.apiHost)

    if (ctx !== null && session !== null) {
      await upstream(
        ctx,
        {
          method: "POST",
          path: options.auth.logout,
          token: session.token,
          timeoutMs: 3_000,
        },
        config
      )
    }

    return withClearedCookie(
      json({
        success: true,
        message: "Logged out",
        data: null,
        meta: {},
        errors: {},
      })
    )
  }

  /** `/bff/session`: `{authenticated, actor, expiresAt}`, never the token. */
  async function sessionStatus(request: Request): Promise<Response> {
    const ctx = context(request)
    const session =
      ctx === null ? null : await currentSession(request, ctx.apiHost)

    return json(
      {
        authenticated: session !== null,
        actor,
        expiresAt: session?.expiresAt ?? null,
        issuedAt: session?.issuedAt ?? null,
      },
      200,
      { "Cache-Control": "no-store" }
    )
  }

  /** `/bff/session/expired?next=`: clears the cookie and goes to login (spec §8.2). */
  function expired(request: Request): Response {
    const url = new URL(request.url)
    const next = safeNext(url.searchParams.get("next"), "/")
    const location = `${options.loginPath}?next=${encodeURIComponent(next)}&expired=1`

    return withClearedCookie(
      new Response(null, { status: 303, headers: { Location: location } })
    )
  }

  /**
   * Server Components: the session and a fetch bound to upstream() for the
   * API client. `requestHeaders` are the incoming request headers.
   */
  async function server(requestHeaders: Headers) {
    const tenant = resolveTenantContext(requestHeaders.get("host"), config)
    if (tenant === null) return null

    const ctx = requestContext(requestHeaders, tenant.apiHost)
    const session = await unsealSession(
      readCookie(requestHeaders.get("cookie"), cookie),
      config
    )
    const valid = isSessionValid(session, actor, tenant.apiHost)
      ? session
      : null

    const fetchUpstream = async (req: Request): Promise<Response> => {
      const url = new URL(req.url)
      const body =
        req.method === "GET" || req.method === "HEAD" ? null : await req.text()
      return upstream(
        ctx,
        {
          method: req.method,
          path: `/api${url.pathname}`,
          search: url.search,
          body,
          headers: req.headers,
          token: valid?.token ?? null,
        },
        config
      )
    }

    return { tenant, session: valid, fetch: fetchUpstream }
  }

  return {
    proxy,
    login,
    refresh,
    logout,
    session: sessionStatus,
    expired,
    server,
    cookieName: cookie,
  }
}

export type Bff = ReturnType<typeof createBff>
