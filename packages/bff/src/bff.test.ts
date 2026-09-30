import { createServer, type IncomingHttpHeaders, type Server } from "node:http"
import type { AddressInfo } from "node:net"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import type { BffConfig } from "./config"
import { createBff } from "./handlers"
import { isAllowed, normalizeUpstreamPath, safeNext } from "./paths"
import { isSessionValid, sealSession, unsealSession } from "./session"
import { resolveTenantContext } from "./tenant"

const secret = Buffer.alloc(32, 7).toString("base64")
const previous = Buffer.alloc(32, 9).toString("base64")

let server: Server
let lastHeaders: IncomingHttpHeaders = {}
let lastUrl = ""
let config: BffConfig

beforeAll(async () => {
  server = createServer((req, res) => {
    lastHeaders = req.headers
    lastUrl = req.url ?? ""
    res.setHeader("Content-Type", "application/json")
    res.setHeader("X-Internal-Secret", "never-forwarded")

    if (req.url === "/api/admin/auth/login") {
      res.end(
        JSON.stringify({
          success: true,
          message: "Logged in",
          data: {
            token: "1|tea_secret",
            token_type: "Bearer",
            expires_at: "2099-01-01T00:00:00+00:00",
            user: { id: 1 },
          },
          meta: {},
          errors: {},
        })
      )
      return
    }

    if (req.headers.authorization === "Bearer revoked") {
      res.statusCode = 401
      res.end(
        JSON.stringify({
          success: false,
          message: "Unauthenticated.",
          data: null,
          meta: { error_code: "unauthenticated", details: {} },
          errors: {},
        })
      )
      return
    }

    res.end(
      JSON.stringify({
        success: true,
        message: "OK",
        data: [],
        meta: {},
        errors: {},
      })
    )
  })

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const { port } = server.address() as AddressInfo

  config = {
    kind: "tenant-admin",
    rootDomain: "ecommerce.localhost",
    laravelUrl: `http://127.0.0.1:${port}`,
    sessionSecret: secret,
    sessionSecretPrevious: previous,
    fallbackTtlMinutes: 720,
    secureCookies: true,
  }
})

afterAll(() => {
  server.close()
})

const bff = () =>
  createBff({
    config,
    actor: "staff",
    allow: [
      {
        methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
        prefix: "/api/admin/",
        except: ["/api/admin/auth/login", "/api/admin/auth/password"],
      },
    ],
    auth: {
      login: "/api/admin/auth/login",
      logout: "/api/admin/auth/logout",
      refresh: "/api/admin/auth/refresh",
    },
    loginPath: "/login",
  })

const HOST = "shop.admin.ecommerce.localhost"

function req(
  path: string,
  init: {
    method?: string
    headers?: Record<string, string>
    body?: string
    host?: string
  } = {}
) {
  return new Request(`https://${init.host ?? HOST}${path}`, {
    method: init.method ?? "GET",
    headers: {
      host: init.host ?? HOST,
      "x-forwarded-proto": "https",
      ...init.headers,
    },
    ...(init.body !== undefined ? { body: init.body } : {}),
  })
}

const csrfHeaders = {
  origin: `https://${HOST}`,
  "x-requested-with": "bff",
  "content-type": "application/json",
}

async function sessionCookie(
  token: string,
  apiHost = "shop.ecommerce.localhost"
) {
  const sealed = await sealSession(
    {
      v: 1,
      actor: "staff",
      token,
      apiHost,
      issuedAt: 1,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    },
    config
  )
  return `__Host-staff=${sealed}`
}

describe("tenant resolution", () => {
  it("maps {slug}.admin.ROOT to {slug}.ROOT and refuses anything else", () => {
    expect(
      resolveTenantContext("Shop.Admin.Ecommerce.Localhost:443", config)
    ).toMatchObject({ apiHost: "shop.ecommerce.localhost", slug: "shop" })
    expect(
      resolveTenantContext("a.b.admin.ecommerce.localhost", config)
    ).toBeNull()
    expect(resolveTenantContext("shop.ecommerce.localhost", config)).toBeNull()
    expect(
      resolveTenantContext("-bad.admin.ecommerce.localhost", config)
    ).toBeNull()
    expect(resolveTenantContext(null, config)).toBeNull()
  })

  it("uses the dev tenant only on localhost", () => {
    const dev = { ...config, devTenantSlug: "shop" }
    expect(resolveTenantContext("localhost:3001", dev)).toMatchObject({
      apiHost: "shop.ecommerce.localhost",
    })
    expect(resolveTenantContext("evil.example.com", dev)).toBeNull()
  })
})

describe("paths", () => {
  it("rejects traversal and encoded separators", () => {
    expect(normalizeUpstreamPath(["admin", "products"])).toBe(
      "/api/admin/products"
    )
    expect(normalizeUpstreamPath(["admin", "..", "internal"])).toBeNull()
    expect(normalizeUpstreamPath(["admin%2Fauth"])).toBeNull()
    expect(normalizeUpstreamPath(["admin", ""])).toBeNull()
  })

  it("applies prefixes and exceptions", () => {
    const rules = [
      {
        methods: ["GET"] as const,
        prefix: "/api/admin/",
        except: ["/api/admin/auth/login"],
      },
    ]
    expect(isAllowed(rules, "GET", "/api/admin/products")).toBe(true)
    expect(isAllowed(rules, "POST", "/api/admin/products")).toBe(false)
    expect(isAllowed(rules, "GET", "/api/admin/auth/login")).toBe(false)
    expect(isAllowed(rules, "GET", "/api/internal/domains")).toBe(false)
  })

  it("only follows same-origin relative next paths", () => {
    expect(safeNext("/orders?page=2", "/")).toBe("/orders?page=2")
    expect(safeNext("//evil.com", "/")).toBe("/")
    expect(safeNext("/\\evil.com", "/")).toBe("/")
    expect(safeNext("https://evil.com", "/")).toBe("/")
  })
})

describe("sessions", () => {
  it("round-trips, accepts the previous key and rejects tampering and other hosts", async () => {
    const session = {
      v: 1 as const,
      actor: "staff" as const,
      token: "t",
      apiHost: "a.ecommerce.localhost",
      issuedAt: 1,
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    }
    const sealed = await sealSession(session, config)

    expect(await unsealSession(sealed, config)).toEqual(session)
    expect(
      await unsealSession(
        await sealSession(session, { sessionSecret: previous }),
        config
      )
    ).toEqual(session)
    expect(await unsealSession(sealed.slice(0, -2) + "xx", config)).toBeNull()
    expect(isSessionValid(session, "staff", "b.ecommerce.localhost")).toBe(
      false
    )
    expect(isSessionValid(session, "customer", "a.ecommerce.localhost")).toBe(
      false
    )
    expect(
      isSessionValid(
        { ...session, expiresAt: 0 },
        "staff",
        "a.ecommerce.localhost"
      )
    ).toBe(false)
  })
})

describe("proxy", () => {
  it("sends the tenant Host, the bearer token and filters response headers", async () => {
    const response = await bff().proxy(
      req("/bff/staff/api/admin/products?page=2", {
        headers: {
          cookie: await sessionCookie("1|tea_x"),
          "x-real-ip": "203.0.113.9",
        },
      }),
      ["admin", "products"]
    )

    expect(response.status).toBe(200)
    expect(lastHeaders.host).toBe("shop.ecommerce.localhost")
    expect(lastHeaders.authorization).toBe("Bearer 1|tea_x")
    expect(lastHeaders["x-forwarded-for"]).toBe("203.0.113.9")
    expect(lastUrl).toBe("/api/admin/products?page=2")
    expect(response.headers.get("x-internal-secret")).toBeNull()
  })

  it("refuses writes without the CSRF headers", async () => {
    const response = await bff().proxy(
      req("/bff/staff/api/admin/products", {
        method: "POST",
        headers: {
          cookie: await sessionCookie("1|tea_x"),
          origin: "https://evil.example",
        },
        body: "{}",
      }),
      ["admin", "products"]
    )
    expect(response.status).toBe(403)
    expect(
      ((await response.json()) as { meta: { error_code: string } }).meta
        .error_code
    ).toBe("csrf_rejected")
  })

  it("refuses paths outside the allow-list and sessions from another tenant", async () => {
    expect(
      (
        await bff().proxy(
          req("/x", { headers: { cookie: await sessionCookie("1|tea_x") } }),
          ["internal", "domains"]
        )
      ).status
    ).toBe(404)

    const copied = await bff().proxy(
      req("/x", {
        headers: {
          cookie: await sessionCookie("1|tea_x", "other.ecommerce.localhost"),
        },
      }),
      ["admin", "products"]
    )
    expect(copied.status).toBe(401)
  })

  it("clears the cookie when Laravel rejects the token", async () => {
    const response = await bff().proxy(
      req("/x", { headers: { cookie: await sessionCookie("revoked") } }),
      ["admin", "products"]
    )
    expect(response.status).toBe(401)
    expect(response.headers.get("set-cookie")).toContain("__Host-staff=;")
  })
})

describe("login", () => {
  it("seals the token into a __Host- cookie and never returns it", async () => {
    const response = await bff().login(
      req("/bff/auth/login", {
        method: "POST",
        headers: csrfHeaders,
        body: JSON.stringify({ email: "a@b.test", password: "x" }),
      })
    )
    const body = (await response.json()) as { data: Record<string, unknown> }
    const setCookie = response.headers.get("set-cookie") ?? ""

    expect(response.status).toBe(200)
    expect(body.data.token).toBeUndefined()
    expect(body.data.user).toEqual({ id: 1 })
    expect(setCookie).toMatch(
      /^__Host-staff=[^;]+; Path=\/; HttpOnly; SameSite=Lax; Secure; Max-Age=\d+/
    )
    expect(setCookie).not.toContain("tea_secret")
  })
})
