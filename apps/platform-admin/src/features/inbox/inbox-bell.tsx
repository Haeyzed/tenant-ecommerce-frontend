"use client"

import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"

import { NotificationBell } from "@workspace/admin-kit/shell"
import { toast } from "@workspace/ui/components/toast"

import { inboxHref, inboxQuery, useMarkAllRead, useMarkRead, type InboxItem } from "./api"

/** The platform user's own inbox in the header (spec §21.1, BG-08). */
export function InboxBell() {
  const router = useRouter()
  const query = useQuery(inboxQuery)
  const markRead = useMarkRead()
  const markAll = useMarkAllRead()

  function select(item: InboxItem) {
    if (!item.read_at) markRead.mutate(item.id)
    const href = inboxHref(item)
    if (href) router.push(href)
  }

  return (
    <NotificationBell<InboxItem>
      items={query.data?.items}
      unreadCount={query.data?.unreadCount ?? 0}
      isLoading={query.isPending}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      onSelect={select}
      onMarkAllRead={() => markAll.mutate(undefined, { onError: () => toast.add({ title: "Couldn't mark everything read", type: "error" }) })}
      markingAll={markAll.isPending}
    />
  )
}
