"use client"

import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"

import { normalizeKpis } from "@workspace/admin-kit/dashboard"
import { unwrap, unwrapPage } from "@workspace/api-client"
import type { components, operations } from "@workspace/contract/landlord"

import { api } from "@/shell/api-client"

export type Transaction = components["schemas"]["PaymentTransactionResource"]
export type TransactionFilters = NonNullable<operations["landlord.billing.payment-transactions.index"]["parameters"]["query"]>

export const TRANSACTION_TYPES = ["charge", "authorization", "refund", "chargeback"] as const
export const TRANSACTION_STATUSES = ["pending", "successful", "failed"] as const
export const PROVIDERS = ["paystack", "flutterwave", "stripe"] as const

export const transactionKeys = {
  all: ["payment-transactions"] as const,
  list: (filters: TransactionFilters) => [...transactionKeys.all, "list", filters] as const,
  detail: (id: number) => [...transactionKeys.all, "detail", id] as const,
  metrics: (mode: string) => [...transactionKeys.all, "metrics", mode] as const,
}

export const transactionsQuery = (filters: TransactionFilters) =>
  queryOptions({
    queryKey: transactionKeys.list(filters),
    queryFn: ({ signal }) => unwrapPage(api.GET("/admin/payment-transactions", { params: { query: filters }, signal })),
  })

export const transactionQuery = (id: number) =>
  queryOptions({
    queryKey: transactionKeys.detail(id),
    queryFn: ({ signal }) => unwrap(api.GET("/admin/payment-transactions/{transaction}", { params: { path: { transaction: id } }, signal })),
  })

export const transactionMetricsQuery = (mode: "live" | "test") =>
  queryOptions({
    queryKey: transactionKeys.metrics(mode),
    queryFn: async ({ signal }) => normalizeKpis(await unwrap(api.GET("/admin/payment-transactions/metrics", { params: { query: { mode } }, signal }))),
    staleTime: 2 * 60_000,
  })

/**
 * A refund (spec §14.6). The route requires an Idempotency-Key: the caller
 * creates one per refund attempt and reuses it on retry, so a repeated
 * request never refunds twice.
 */
export function useRefund(id: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ amount, reason, idempotencyKey }: { amount: number | null; reason: string; idempotencyKey: string }) =>
      unwrap(
        api.POST("/admin/payment-transactions/{transaction}/refund", {
          params: { path: { transaction: id } },
          body: { reason, ...(amount === null ? {} : { amount }) },
          headers: { "Idempotency-Key": idempotencyKey },
        })
      ),
    onSuccess: () => void client.invalidateQueries({ queryKey: transactionKeys.all }),
  })
}

/** Line item shape (App\Modules\Billing\Services\SubscriptionBillingService). */
export type LineItem = { type: string; label: string; amount: string }

export function lineItems(transaction: Transaction): LineItem[] {
  return transaction.line_items.flatMap((item) => {
    const amount = typeof item.amount === "string" || typeof item.amount === "number" ? String(item.amount) : null
    return amount === null ? [] : [{ type: typeof item.type === "string" ? item.type : "line", label: typeof item.label === "string" ? item.label : "Item", amount }]
  })
}
