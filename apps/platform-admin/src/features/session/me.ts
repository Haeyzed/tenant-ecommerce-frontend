import type { AccessSnapshot } from "@workspace/access"
import type { DisplaySettings } from "@workspace/format"

/**
 * The platform-user session (spec §25.2), normalised from
 * GET /api/admin/auth/me on the landlord. There are no modules on the
 * landlord, so gating is by permission only.
 * @source App\Modules\Auth\Services\Landlord\AuthService::profile
 */
export type PlatformSession = {
  user: { id: number; name: string; email: string }
  roles: string[]
  permissions: string[]
  display: DisplaySettings
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback)
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [])

export function normalizeMe(data: unknown): PlatformSession {
  const me = isRecord(data) ? data : {}
  const user = isRecord(me.user) ? me.user : {}
  const display = isRecord(me.display) ? me.display : {}

  return {
    user: { id: typeof user.id === "number" ? user.id : 0, name: str(user.name), email: str(user.email) },
    roles: strings(me.roles),
    permissions: strings(me.permissions),
    display: {
      date_format: str(display.date_format, "YYYY-MM-DD"),
      time_format: str(display.time_format, "24h"),
      timezone: str(display.timezone, "UTC"),
    },
  }
}

export function toAccessSnapshot(session: PlatformSession): AccessSnapshot {
  return { permissions: new Set(session.permissions), roles: session.roles, modules: {}, isOwner: session.roles.includes("super-admin") }
}
