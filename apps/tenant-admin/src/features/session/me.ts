import type { AccessSnapshot, ModuleState } from "@workspace/access"
import type { DisplaySettings } from "@workspace/format"

/**
 * The staff session snapshot (spec §10.2), normalised from
 * GET /api/admin/auth/me. OpenAPI infers `roles`, `modules` and
 * `permissions` imprecisely and marks owner-only fields as always present,
 * so the payload is checked here once (the §13.2 response overlay).
 */
export type StaffUser = {
  id: number
  name: string
  email: string
  phone: string | null
  preferences: { date_format: string | null; time_format: string | null }
  last_login_at: string | null
}

export type TenantIdentity = {
  id: string
  slug: string
  primary_domain: string | null
}

export type LegalDocumentSummary = {
  id: number
  document_type: string
  version: string
  title: string
}

export type StaffSession = {
  user: StaffUser
  tenant: TenantIdentity
  roles: string[]
  permissions: string[]
  isOwner: boolean
  modules: Record<string, ModuleState>
  display: DisplaySettings
  paymentMode: "test" | "live"
  /** Owner only. */
  tenantStatus: string | null
  subscriptionStatus: string | null
  pendingLegalDocuments: LegalDocumentSummary[]
}

const MODULE_STATES = new Set<ModuleState>([
  "unavailable",
  "available",
  "enabled",
  "disabled",
  "locked",
  "suspended",
])

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)
const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback
const strOrNull = (v: unknown): string | null =>
  typeof v === "string" ? v : null
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []

export function normalizeMe(data: unknown): StaffSession {
  const me = isRecord(data) ? data : {}
  const user = isRecord(me.user) ? me.user : {}
  const tenant = isRecord(me.tenant) ? me.tenant : {}
  const display = isRecord(me.display) ? me.display : {}
  const prefs = isRecord(user.preferences) ? user.preferences : {}

  const modules: Record<string, ModuleState> = {}
  if (isRecord(me.modules)) {
    for (const [key, state] of Object.entries(me.modules)) {
      if (typeof state === "string" && MODULE_STATES.has(state as ModuleState))
        modules[key] = state as ModuleState
    }
  }

  return {
    user: {
      id: typeof user.id === "number" ? user.id : 0,
      name: str(user.name),
      email: str(user.email),
      phone: strOrNull(user.phone),
      preferences: {
        date_format: strOrNull(prefs.date_format),
        time_format: strOrNull(prefs.time_format),
      },
      last_login_at: strOrNull(user.last_login_at),
    },
    tenant: {
      id: str(tenant.id),
      slug: str(tenant.slug),
      primary_domain: strOrNull(tenant.primary_domain),
    },
    roles: strings(me.roles),
    permissions: strings(me.permissions),
    isOwner: me.is_owner === true,
    modules,
    display: {
      date_format: str(display.date_format, "YYYY-MM-DD"),
      time_format: str(display.time_format, "24h"),
      timezone: str(display.timezone, "UTC"),
    },
    paymentMode: me.payment_mode === "live" ? "live" : "test",
    tenantStatus: strOrNull(me.tenant_status),
    subscriptionStatus: strOrNull(me.subscription_status),
    pendingLegalDocuments: Array.isArray(me.pending_legal_documents)
      ? me.pending_legal_documents.filter(isRecord).map((d) => ({
          id: typeof d.id === "number" ? d.id : 0,
          document_type: str(d.document_type),
          version: str(d.version),
          title: str(d.title),
        }))
      : [],
  }
}

export function toAccessSnapshot(session: StaffSession): AccessSnapshot {
  return {
    permissions: new Set(session.permissions),
    roles: session.roles,
    modules: session.modules,
    isOwner: session.isOwner,
  }
}
