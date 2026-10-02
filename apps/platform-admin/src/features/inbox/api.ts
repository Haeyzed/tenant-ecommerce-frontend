"use client"

import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"

import { unwrap, unwrapPage, type Page } from "@workspace/api-client"
import type { operations } from "@workspace/contract/landlord"

import { api } from "@/shell/api-client"

export type InboxItem = operations["landlord.notifications.inbox.index"]["responses"][200]["content"]["application/json"]["data"][number]
export type Inbox = { items: InboxItem[]; unreadCount: number }

const inboxKey = ["inbox"] as const

/** The latest 20 messages; the bell polls every 60 s while the tab is visible (spec §21.1). */
export const inboxQuery = queryOptions({
  queryKey: inboxKey,
  queryFn: async ({ signal }): Promise<Inbox> => {
    const page = await unwrapPage(api.GET("/admin/notifications", { params: { query: { per_page: 20 } }, signal }))
    return { items: page.items, unreadCount: unreadCountOf(page) }
  },
  refetchInterval: 60_000,
  refetchIntervalInBackground: false,
})

/** `meta.unread_count` is added by the controller, outside the generated contract. */
export function unreadCountOf(page: Pick<Page<unknown>, "meta">): number {
  const count = page.meta.unread_count
  return typeof count === "number" && count >= 0 ? count : 0
}

/** Marks items read in a cached inbox and lowers the unread count to match. */
export function markLocally(inbox: Inbox | undefined, ids: Set<string> | "all"): Inbox | undefined {
  if (!inbox) return inbox
  const now = new Date().toISOString()
  let marked = 0
  const items = inbox.items.map((item) => {
    if (item.read_at || (ids !== "all" && !ids.has(item.id))) return item
    marked += 1
    return { ...item, read_at: now }
  })
  return { items, unreadCount: ids === "all" ? 0 : Math.max(0, inbox.unreadCount - marked) }
}

function useOptimisticInbox() {
  const client = useQueryClient()
  return {
    async apply(ids: Set<string> | "all") {
      await client.cancelQueries({ queryKey: inboxKey })
      const previous = client.getQueryData<Inbox>(inboxKey)
      client.setQueryData<Inbox>(inboxKey, (inbox) => markLocally(inbox, ids))
      return { previous }
    },
    rollback(context: { previous: Inbox | undefined } | undefined) {
      if (context?.previous) client.setQueryData(inboxKey, context.previous)
    },
    refresh: () => void client.invalidateQueries({ queryKey: inboxKey }),
  }
}

export function useMarkRead() {
  const inbox = useOptimisticInbox()
  return useMutation({
    mutationFn: async (id: string) => unwrap(api.POST("/admin/notifications/{id}/read", { params: { path: { id } } })),
    onMutate: (id) => inbox.apply(new Set([id])),
    onError: (_e, _id, context) => inbox.rollback(context),
    onSettled: inbox.refresh,
  })
}

export function useMarkAllRead() {
  const inbox = useOptimisticInbox()
  return useMutation({
    mutationFn: async () => unwrap(api.POST("/admin/notifications/read-all")),
    onMutate: () => inbox.apply("all"),
    onError: (_e, _v, context) => inbox.rollback(context),
    onSettled: inbox.refresh,
  })
}

/**
 * Where a notification leads in this console, or null. Only screens that
 * exist are linked: exports (`export_id`) and helpdesk conversations
 * (`conversation_id`) join as those screens ship.
 */
export function inboxHref(item: Pick<InboxItem, "key" | "data">): string | null {
  if (item.key === "affiliate.application_submitted") {
    const id = item.data.affiliate_id
    return typeof id === "number" && Number.isInteger(id) ? `/affiliates/${id}` : "/affiliates?status=pending"
  }
  return SCREENS[item.key] ?? null
}

const SCREENS: Record<string, string> = {
  "platform.onboarding_paused": "/platform-settings",
  "platform.billing_mode_changed": "/payment-gateways",
  "platform.webhook_failures": "/payment-gateways",
  "platform.provisioning_failed": "/tenant-registrations",
  "platform.billing_payment_failed_alert": "/payment-transactions",
  "affiliate.referral_flagged": "/affiliate-referrals?review=true",
  "affiliate.commissions_awaiting_approval": "/affiliate-commissions?eligible=true",
  "affiliate.payouts_ready": "/affiliate-payouts?pstatus=pending",
}
