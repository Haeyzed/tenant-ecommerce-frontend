"use client"

import { useState } from "react"

import { formatRelative } from "@workspace/format"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { Icon } from "@workspace/ui/icons"

export type BellItem = {
  id: string
  subject: string | null
  body: string | null
  source: "store" | "platform"
  read_at: string | null
  created_at: string | null
}

/** "99+" above 99 (spec §21.1). */
export function unreadLabel(count: number): string {
  return count > 99 ? "99+" : String(count)
}

/**
 * The header bell (spec §21.1): unread count, the latest messages and mark
 * all read. Data and actions come from the app, which polls the inbox.
 */
export function NotificationBell<T extends BellItem>({
  items,
  unreadCount,
  isLoading,
  isError,
  onRetry,
  onSelect,
  onMarkAllRead,
  markingAll = false,
  showSource = false,
}: {
  items: T[] | undefined
  unreadCount: number
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  /** Marks it read and opens what it refers to; the bell closes first. */
  onSelect: (item: T) => void
  onMarkAllRead: () => void
  markingAll?: boolean
  /** Shows a "Platform" badge on platform-sourced notices (tenant staff inboxes). */
  showSource?: boolean
}) {
  const [open, setOpen] = useState(false)
  const label = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={label} className="relative">
            <Icon name="notifications" />
            {unreadCount > 0 ? (
              <span
                aria-hidden
                className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white tabular-nums"
              >
                {unreadLabel(unreadCount)}
              </span>
            ) : null}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] gap-0 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <p className="font-medium">Notifications</p>
          {unreadCount > 0 ? (
            <Button variant="ghost" size="xs" onClick={onMarkAllRead} disabled={markingAll}>
              {markingAll ? <Spinner data-icon="inline-start" /> : null}
              Mark all read
            </Button>
          ) : null}
        </div>
        <div className="max-h-[min(28rem,70svh)] overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
              <p>Couldn&apos;t load notifications.</p>
              <Button variant="outline" size="sm" onClick={onRetry}>
                Try again
              </Button>
            </div>
          ) : !items || items.length === 0 ? (
            <div className="flex flex-col items-center gap-1 p-6 text-center text-muted-foreground">
              <Icon name="notifications" className="size-5" />
              <p>You&apos;re all caught up.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      onSelect(item)
                    }}
                    className={cn(
                      "flex w-full gap-2 px-3 py-2.5 text-start outline-none hover:bg-muted focus-visible:bg-muted",
                      item.read_at ? "text-muted-foreground" : null
                    )}
                  >
                    <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.read_at ? "bg-transparent" : "bg-primary")} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-1.5">
                        <span className={cn("truncate", item.read_at ? null : "font-medium text-foreground")}>{item.subject ?? "Notification"}</span>
                        {showSource && item.source === "platform" ? <Badge variant="outline">Platform</Badge> : null}
                      </span>
                      {item.body ? <span className="line-clamp-2 text-xs text-muted-foreground">{item.body}</span> : null}
                      <span className="text-xs text-muted-foreground">
                        {item.read_at ? null : <span className="sr-only">Unread. </span>}
                        {formatRelative(item.created_at)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
