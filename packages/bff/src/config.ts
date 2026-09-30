/** The actors that hold a session cookie (spec §8.2). */
export type Actor = "platform" | "affiliate" | "staff" | "seller" | "customer"

/** Which upstream an app talks to and how its tenant is found (spec §7.4). */
export type AppKind = "landlord" | "tenant-admin" | "storefront"

export type HttpMethod = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE"

/** One allow-list rule: a method set and an upstream path prefix (spec §8.5). */
export type AllowRule = {
  methods: readonly HttpMethod[]
  /** Upstream path prefix, e.g. "/api/admin/". */
  prefix: string
  /** Prefixes under `prefix` that stay blocked, e.g. auth routes. */
  except?: readonly string[]
}

/** Server configuration each app passes in from its validated env. */
export type BffConfig = {
  kind: AppKind
  /** The platform root domain, equal to the backend PLATFORM_ROOT_DOMAIN. */
  rootDomain: string
  /** Private Laravel address, e.g. "http://127.0.0.1:8000". */
  laravelUrl: string
  /** 32-byte base64 JWE keys; `previous` is accepted for decryption during rotation. */
  sessionSecret: string
  sessionSecretPrevious?: string | undefined
  /** Fallback token lifetime when a login response has no expires_at. */
  fallbackTtlMinutes: number
  /** Secure cookies with the __Host- prefix. Off only for plain-http local development. */
  secureCookies: boolean
  /**
   * Local development only: the tenant slug to use when the app is reached
   * on localhost without the edge (spec §38.6). Ignored unless set.
   */
  devTenantSlug?: string | undefined
  /**
   * Local development only: the admin host suffix that maps
   * `{slug}.{devAdminHost}` to the store `{slug}.{rootDomain}`, e.g.
   * "admin.localhost" (browsers resolve *.localhost to this machine).
   */
  devAdminHost?: string | undefined
}
