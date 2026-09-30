"use client"

import { queryOptions, useQuery } from "@tanstack/react-query"

import type { Option } from "@workspace/admin-kit/lookup"
import { unwrap } from "@workspace/api-client"

import { api } from "@/shell/api-client"

/** The public landlord lookups (spec §14.3). Short, static lists, loaded whole. */
export type LookupKey = "currencies" | "countries" | "languages"

const isRow = (row: unknown): row is { value: string | number; label: string } =>
  typeof row === "object" &&
  row !== null &&
  "value" in row &&
  (typeof row.value === "string" || typeof row.value === "number") &&
  "label" in row &&
  typeof row.label === "string"

export const lookupQuery = (key: LookupKey) =>
  queryOptions({
    queryKey: ["lookup", key],
    queryFn: async ({ signal }): Promise<Option[]> => {
      const data = await unwrap(api.GET("/lookups/{key}", { params: { path: { key } }, signal }))
      return (Array.isArray(data) ? data : []).filter(isRow).map((row) => ({ value: String(row.value), label: row.label }))
    },
    staleTime: 30 * 60_000,
  })

export function useLookup(key: LookupKey) {
  return useQuery(lookupQuery(key))
}
