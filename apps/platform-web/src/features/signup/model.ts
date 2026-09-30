import type { components } from "@workspace/contract/landlord"

/**
 * Public plan shapes. The generated contract types `prices` and `features`
 * as strings (the controller builds them inline), so responses are
 * normalised here instead of cast.
 * @source App\Modules\Plans\Services\PlanService::presentPublic
 */
export type PlanPrice = {
  id: number
  currencyCode: string
  interval: string
  amount: string
  trialDays: number
  trialRequiresPaymentMethod: boolean
  annualSavingsPercent: number | null
}

export type PlanFeature = { key: string; name: string }

export type Plan = {
  id: number
  name: string
  slug: string
  description: string | null
  tagline: string | null
  isRecommended: boolean
  badge: string | null
  prices: PlanPrice[]
  /** Features grouped by kind (module, capability, integration). */
  features: { kind: string; items: PlanFeature[] }[]
  limits: Record<string, number | null>
}

export type LegalDocument = components["schemas"]["LegalDocumentResource"]

export type PlatformConfig = {
  name: string
  logoUrl: string | null
  registrationEnabled: boolean
  supportEmail: string | null
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)
const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null)
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)

function normalizePrice(row: unknown): PlanPrice | null {
  if (!isRecord(row)) return null
  const id = num(row.id)
  const currencyCode = str(row.currency_code)
  const amount = typeof row.amount === "number" ? String(row.amount) : str(row.amount)
  if (id === null || currencyCode === null || amount === null) return null

  return {
    id,
    currencyCode,
    interval: str(row.billing_interval) ?? "monthly",
    amount,
    trialDays: num(row.trial_days) ?? 0,
    trialRequiresPaymentMethod: row.trial_requires_payment_method === true,
    annualSavingsPercent: num(row.annual_savings_percent),
  }
}

function normalizeFeatures(value: unknown): Plan["features"] {
  if (!isRecord(value)) return []

  return Object.entries(value).map(([kind, items]) => ({
    kind,
    items: (Array.isArray(items) ? items : []).flatMap((item): PlanFeature[] => {
      if (!isRecord(item)) return []
      const key = str(item.key)
      return key === null ? [] : [{ key, name: str(item.name) ?? key }]
    }),
  }))
}

export function normalizePlan(row: unknown): Plan | null {
  if (!isRecord(row)) return null
  const id = num(row.id)
  const name = str(row.name)
  if (id === null || name === null) return null

  const limits: Record<string, number | null> = {}
  if (isRecord(row.limits)) {
    for (const [key, value] of Object.entries(row.limits)) limits[key] = num(value)
  }

  return {
    id,
    name,
    slug: str(row.slug) ?? String(id),
    description: str(row.description),
    tagline: str(row.tagline),
    isRecommended: row.is_recommended === true,
    badge: str(row.marketing_badge),
    prices: (Array.isArray(row.prices) ? row.prices : []).map(normalizePrice).filter((p): p is PlanPrice => p !== null),
    features: normalizeFeatures(row.features),
    limits,
  }
}

export function normalizePlans(data: unknown): Plan[] {
  return (Array.isArray(data) ? data : []).map(normalizePlan).filter((p): p is Plan => p !== null)
}

export function normalizePlatformConfig(data: unknown): PlatformConfig {
  const config = isRecord(data) ? data : {}

  return {
    name: str(config.platform_name) ?? "Our platform",
    logoUrl: str(config.platform_logo_url),
    registrationEnabled: config.tenant_registration_enabled !== false,
    supportEmail: str(config.support_email),
  }
}

/** Finds a price and its plan by price id (the `?price=` in the signup URL). */
export function findPrice(plans: Plan[], priceId: number): { plan: Plan; price: PlanPrice } | null {
  for (const plan of plans) {
    const price = plan.prices.find((p) => p.id === priceId)
    if (price) return { plan, price }
  }
  return null
}

/** Registrations are addressed by their public UUID only. */
export function isRegistrationId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

/** The store's slug is the first label of its domain (spec §24.3 step 6). */
export function slugFromDomain(domain: string | null | undefined): string | null {
  const slug = domain?.split(".")[0]
  return slug ? slug : null
}

/** Human labels for limit keys shown on the pricing cards. */
export const LIMIT_LABELS: Record<string, string> = {
  max_users: "Staff accounts",
  max_products: "Products",
  max_warehouses: "Warehouses",
  max_orders_per_month: "Orders a month",
  max_storage_mb: "Storage",
  max_pos_registers: "POS registers",
  max_custom_domains: "Custom domains",
}

export function formatLimit(key: string, value: number | null): string {
  if (value === null) return "Unlimited"
  if (key === "max_storage_mb") return value >= 1024 ? `${Math.round(value / 1024)} GB` : `${value} MB`
  return new Intl.NumberFormat(SITE_LOCALE).format(value)
}

/**
 * One locale for server and browser rendering, so prices hydrate
 * identically (Node and the browser default to different locales).
 */
export const SITE_LOCALE = "en-US"

export const INTERVAL_LABELS: Record<string, string> = { monthly: "month", yearly: "year" }
