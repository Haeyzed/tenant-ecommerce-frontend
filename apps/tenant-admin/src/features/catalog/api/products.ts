import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import {
  createParser,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs"

import { unwrap, unwrapPage } from "@workspace/api-client"
import { isBulkResult } from "@workspace/admin-kit/table"

import { api } from "@/shell/api-client"

export const PRODUCT_TYPES = [
  "simple",
  "variable",
  "bundle",
  "digital",
  "service",
] as const
export type ProductType = (typeof PRODUCT_TYPES)[number]

/** URL state for the product list; names are the API's query names (spec §15.3). */
export const productListParams = {
  search: parseAsString.withDefault(""),
  product_type: parseAsStringLiteral(PRODUCT_TYPES),
  is_active: parseAsBoolean,
  brand_id: parseAsInteger,
  category_id: parseAsInteger,
  page: parseAsInteger.withDefault(1),
  per_page: createParser({
    parse: (v) => ([15, 25, 50, 100].includes(Number(v)) ? Number(v) : null),
    serialize: String,
  }).withDefault(25),
}

export type ProductListFilters = {
  search: string
  product_type: ProductType | null
  is_active: boolean | null
  brand_id: number | null
  category_id: number | null
  page: number
  per_page: number
}

export const productKeys = {
  all: ["products"] as const,
  lists: () => [...productKeys.all, "list"] as const,
  list: (filters: ProductListFilters) =>
    [...productKeys.lists(), filters] as const,
  detail: (id: number) => [...productKeys.all, "detail", id] as const,
}

async function fetchProducts(filters: ProductListFilters, signal: AbortSignal) {
  return unwrapPage(
    api.GET("/admin/products", {
      params: {
        query: {
          search: filters.search || undefined,
          product_type: filters.product_type ?? undefined,
          is_active: filters.is_active ?? undefined,
          brand_id: filters.brand_id ?? undefined,
          category_id: filters.category_id ?? undefined,
          per_page: filters.per_page,
          // `page` is read by Laravel's paginator though OpenAPI does not list it.
          ...({ page: filters.page } as Record<string, number>),
        },
      },
      signal,
    })
  )
}

export type ProductPage = Awaited<ReturnType<typeof fetchProducts>>
export type ProductRow = ProductPage["items"][number]

export const productListQuery = (filters: ProductListFilters) =>
  queryOptions({
    queryKey: productKeys.list(filters),
    queryFn: ({ signal }) => fetchProducts(filters, signal),
    placeholderData: keepPreviousData,
  })

/** Activate or deactivate up to 100 products; one result per item (spec §19.1). */
export function useProductBulk() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      action,
      ids,
    }: {
      action: "activate" | "deactivate"
      ids: number[]
    }) => {
      const result = await unwrap(
        api.POST("/admin/products/bulk", { body: { action, ids } })
      )
      if (!isBulkResult(result)) throw new Error("Unexpected bulk response")
      return result
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: productKeys.lists() }),
  })
}

export function useSetProductActive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) =>
      unwrap(
        api.PATCH("/admin/products/{product}", {
          params: { path: { product: id } },
          body: { is_active: isActive },
        })
      ),
    onSettled: (_data, _error, { id }) => {
      void queryClient.invalidateQueries({ queryKey: productKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: productKeys.detail(id) })
    },
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) =>
      unwrap(
        api.DELETE("/admin/products/{product}", {
          params: { path: { product: id } },
        })
      ),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: productKeys.lists() }),
  })
}
