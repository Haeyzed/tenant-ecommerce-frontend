import { queryOptions, type QueryClient } from "@tanstack/react-query"

import { unwrap } from "@workspace/api-client"

import { api } from "@/shell/api-client"

/**
 * A lookup row (spec §45): every lookup returns `{value, label, meta?}`.
 * @source App\Modules\Lookups\Support\LookupRegistry
 */
export type LookupItem = { value: number | string; label: string; meta?: Record<string, unknown> }

/** Keys the tenant public lookup group serves (GET /api/lookups/{key}). */
type PublicLookupKey = "brands" | "categories" | "countries" | "currencies" | "languages" | "timezones" | "product-types"
/** Keys the tenant admin lookup group serves (GET /api/admin/lookups/{key}). */
type AdminLookupKey = "roles" | "warehouses" | "units-of-measure" | "customer-groups" | "staff-users" | "shipping-zones" | "suppliers" | "departments"

export type LookupKey = PublicLookupKey | AdminLookupKey

const PUBLIC_KEYS = new Set<string>(["brands", "categories", "countries", "currencies", "languages", "timezones", "product-types"])

const isLookupItem = (row: unknown): row is LookupItem =>
  typeof row === "object" &&
  row !== null &&
  (typeof (row as LookupItem).value === "number" || typeof (row as LookupItem).value === "string") &&
  typeof (row as LookupItem).label === "string"

export const lookupQuery = (key: LookupKey) =>
  queryOptions({
    queryKey: ["lookup", key] as const,
    queryFn: async ({ signal }) => {
      const data = PUBLIC_KEYS.has(key)
        ? await unwrap(api.GET("/lookups/{key}", { params: { path: { key } }, signal }))
        : await unwrap(api.GET("/admin/lookups/{key}", { params: { path: { key } }, signal }))
      return (Array.isArray(data) ? data : []).filter(isLookupItem)
    },
    staleTime: 30 * 60_000,
  })

/**
 * A combobox `search` over a cached lookup list: fetched once, filtered
 * locally, because these lists are small and bounded (spec §14.3).
 */
export function lookupSearch(queryClient: QueryClient, key: LookupKey) {
  return async (term: string) => {
    // Served from the cache while fresh (30 minutes); fetched once otherwise.
    const rows = await queryClient.fetchQuery(lookupQuery(key))
    const needle = term.toLowerCase()
    return (needle ? rows.filter((row) => row.label.toLowerCase().includes(needle)) : rows).slice(0, 50)
  }
}
