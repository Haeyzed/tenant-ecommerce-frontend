import type { BffConfig } from "./config"

/** Where a request goes upstream (spec §7.4). */
export type TenantContext =
  | { kind: "landlord"; apiHost: string }
  | { kind: "tenant"; apiHost: string; requestHost: string; slug: string | null }

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

/** The request host, port stripped and lower-cased; null when missing or malformed. */
export function normalizeHost(raw: string | null): string | null {
  if (!raw) return null

  const host = raw.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "")

  if (host.length === 0 || host.length > 253) return null

  return host.split(".").every((label) => LABEL.test(label)) ? host : null
}

const isLocalHost = (host: string) => host === "localhost" || host === "127.0.0.1"

/**
 * Resolves the upstream host from the request host, once per request. No
 * header, cookie, query or body field selects a tenant (spec §7.5).
 * Returns null when the host is not acceptable; the caller answers 404.
 */
export function resolveTenantContext(rawHost: string | null, config: Pick<BffConfig, "kind" | "rootDomain" | "devTenantSlug">): TenantContext | null {
  const root = config.rootDomain.toLowerCase()

  if (config.kind === "landlord") {
    return { kind: "landlord", apiHost: root }
  }

  const host = normalizeHost(rawHost)
  if (host === null) return null

  // Local development without the edge: a fixed tenant (spec §38.6).
  if (config.devTenantSlug && isLocalHost(host)) {
    const slug = config.devTenantSlug.toLowerCase()
    return SLUG.test(slug) ? { kind: "tenant", apiHost: `${slug}.${root}`, requestHost: host, slug } : null
  }

  if (config.kind === "tenant-admin") {
    const suffix = `.admin.${root}`
    if (!host.endsWith(suffix)) return null

    const slug = host.slice(0, -suffix.length)
    return SLUG.test(slug) ? { kind: "tenant", apiHost: `${slug}.${root}`, requestHost: host, slug } : null
  }

  // Storefront: any valid host; Laravel decides whether it is a tenant.
  const slug = host.endsWith(`.${root}`) ? host.slice(0, -(root.length + 1)) : null
  return { kind: "tenant", apiHost: host, requestHost: host, slug: slug !== null && SLUG.test(slug) ? slug : null }
}
