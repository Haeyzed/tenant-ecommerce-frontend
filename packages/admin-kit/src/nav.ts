import {
  routeVisibility,
  type AccessSnapshot,
  type Manifest,
} from "@workspace/access"
import type { IconName } from "@workspace/ui/icons"

/** One navigation entry (spec §17.2). Module and permission come from the route manifest. */
export type NavEntry = {
  id: string
  label: string
  icon: IconName
  href: string
  /** The Laravel route behind the page. */
  route: string
  group: string
  order: number
  keywords?: string[]
  children?: NavEntry[]
}

export type NavGroup = { id: string; label: string }

export type VisibleEntry = NavEntry & {
  inactive: boolean
  children?: VisibleEntry[]
}

export type VisibleGroup = NavGroup & { entries: VisibleEntry[] }

export const INACTIVE_GROUP: NavGroup = {
  id: "inactive",
  label: "Inactive modules",
}

function resolve(
  entry: NavEntry,
  snapshot: AccessSnapshot,
  manifest: Manifest
): VisibleEntry | null {
  const children = entry.children
    ?.map((child) => resolve(child, snapshot, manifest))
    .filter((child): child is VisibleEntry => child !== null)

  // A parent with children is shown when any child is (spec §17.2 rule 5).
  if (entry.children) {
    if (!children || children.length === 0) return null
    return { ...entry, children, inactive: children.every((c) => c.inactive) }
  }

  const visibility = routeVisibility(snapshot, manifest, entry.route)
  if (visibility === "hidden") return null

  // A leaf has no children (the branch above returned for parents).
  return { ...entry, children: undefined, inactive: visibility === "inactive" }
}

/**
 * The navigation the user sees: groups in order, entries sorted, inactive
 * module entries moved to the "Inactive modules" group (spec §17.2).
 */
export function visibleNav(
  groups: readonly NavGroup[],
  entries: readonly NavEntry[],
  snapshot: AccessSnapshot,
  manifest: Manifest
): VisibleGroup[] {
  const resolved = entries
    .map((entry) => resolve(entry, snapshot, manifest))
    .filter((entry): entry is VisibleEntry => entry !== null)
    .sort((a, b) => a.order - b.order)

  const result: VisibleGroup[] = groups.map((group) => ({
    ...group,
    entries: resolved.filter(
      (entry) => entry.group === group.id && !entry.inactive
    ),
  }))

  const inactive = resolved.filter((entry) => entry.inactive)
  if (inactive.length > 0) result.push({ ...INACTIVE_GROUP, entries: inactive })

  return result.filter((group) => group.entries.length > 0)
}

/** Every route a navigation tree references, for the generated missing-route test (spec §17.2 rule 1). */
export function navRoutes(entries: readonly NavEntry[]): string[] {
  return entries.flatMap((entry) => [
    entry.route,
    ...navRoutes(entry.children ?? []),
  ])
}
