import type { HttpMethod, RouteEntry } from "@workspace/contract/manifest"
import type { ModuleKey } from "@workspace/contract/registries"

/** A module's state as the backend reports it (spec §11.2). */
export type ModuleState = "unavailable" | "available" | "enabled" | "disabled" | "locked" | "suspended"

/**
 * The access snapshot loaded once per session under ['session', 'me']
 * (spec §10.2). Tenant-only fields are absent on the landlord.
 */
export type AccessSnapshot = {
  permissions: ReadonlySet<string>
  roles: readonly string[]
  /** Tenant only; empty on the landlord. */
  modules: Readonly<Partial<Record<ModuleKey, ModuleState>>>
  isOwner: boolean
}

export type Manifest = Readonly<Record<string, RouteEntry>>

const READ_METHODS: readonly HttpMethod[] = ["GET"]

export function moduleState(snapshot: AccessSnapshot, key: string | null): ModuleState {
  if (key === null) return "enabled"
  return snapshot.modules[key as ModuleKey] ?? "unavailable"
}

/** A route's module passes: enabled; disabled/locked with read-when-inactive on a GET; or a wind-down route. */
function modulePasses(snapshot: AccessSnapshot, entry: RouteEntry): boolean {
  const state = moduleState(snapshot, entry.module)

  if (state === "enabled") return true
  if (state === "suspended") return false
  if (state === "disabled" || state === "locked") {
    return entry.windDown || (entry.readWhenInactive && entry.methods.every((m) => READ_METHODS.includes(m)))
  }

  return false
}

/**
 * Whether the user can call a route (spec §10.3): module state first, then
 * the permission. Unknown routes are refused, never guessed.
 */
export function canRoute(snapshot: AccessSnapshot, manifest: Manifest, route: string): boolean {
  const entry = manifest[route]
  if (!entry) return false
  if (!modulePasses(snapshot, entry)) return false
  return entry.permission === null || snapshot.permissions.has(entry.permission)
}

/** Readable: enabled, or disabled/locked where the module reads while inactive. */
export function canRead(snapshot: AccessSnapshot, key: string, readWhenInactive: boolean): boolean {
  const state = moduleState(snapshot, key)
  return state === "enabled" || (readWhenInactive && (state === "disabled" || state === "locked"))
}

export function canWrite(snapshot: AccessSnapshot, key: string | null): boolean {
  return moduleState(snapshot, key) === "enabled"
}

/**
 * Every route in the manifest the user can call, for the client gates.
 * `groups` narrows it to the app's own route groups (e.g. tenant.admin).
 */
export function allowedRoutes(snapshot: AccessSnapshot, manifest: Manifest, groups: readonly string[]): string[] {
  return Object.entries(manifest)
    .filter(([name, entry]) => entry.group !== null && groups.includes(entry.group) && canRoute(snapshot, manifest, name))
    .map(([name]) => name)
}

/** Navigation visibility (spec §17.2). */
export type Visibility = "visible" | "inactive" | "hidden"

export function routeVisibility(snapshot: AccessSnapshot, manifest: Manifest, route: string): Visibility {
  const entry = manifest[route]
  if (!entry) return "hidden"

  const permitted = entry.permission === null || snapshot.permissions.has(entry.permission)
  if (!permitted) return "hidden"

  const state = moduleState(snapshot, entry.module)
  if (state === "enabled") return "visible"
  if ((state === "disabled" || state === "locked") && entry.readWhenInactive) return "inactive"
  return "hidden"
}
