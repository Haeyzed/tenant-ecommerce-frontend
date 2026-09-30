import { queryOptions, type QueryClient } from "@tanstack/react-query"

import { unwrap } from "@workspace/api-client"

import { api } from "@/shell/api-client"

/** A lookup row: small reference lists from GET /api/admin/lookups/{key} (spec §14.3). */
export type LookupItem = { id: number; name: string; [key: string]: unknown }

/** Keys served by the backend LookupRegistry that return {id, name} rows. */
export type LookupKey =
  | "brands"
  | "categories"
  | "warehouses"
  | "customer-groups"
  | "staff-users"
  | "roles"
  | "shipping-zones"
  | "units-of-measure"
  | "suppliers"
  | "departments"

export const lookupQuery = (key: LookupKey) =>
  queryOptions({
    queryKey: ["lookup", key] as const,
    queryFn: async ({ signal }) => {
      const data = await unwrap(
        api.GET("/admin/lookups/{key}", { params: { path: { key } }, signal })
      )
      return (Array.isArray(data) ? data : []).filter(
        (row): row is LookupItem =>
          typeof row === "object" &&
          row !== null &&
          typeof (row as LookupItem).id === "number" &&
          typeof (row as LookupItem).name === "string"
      )
    },
    staleTime: 30 * 60_000,
  })

/**
 * A combobox `search` over a cached lookup list: fetched once, filtered
 * locally, because these lists are small and bounded.
 */
export function lookupSearch(queryClient: QueryClient, key: LookupKey) {
  return async (term: string) => {
    const rows = await queryClient.ensureQueryData(lookupQuery(key))
    const needle = term.toLowerCase()
    return (
      needle
        ? rows.filter((row) => row.name.toLowerCase().includes(needle))
        : rows
    ).slice(0, 50)
  }
}
