"use client"

import type { ReactNode } from "react"

import { isApiError } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty"
import { Icon, type IconName } from "@workspace/ui/icons"

type StateProps = {
  icon: IconName
  title: string
  description: ReactNode
  action?: ReactNode
  /** Compact states sit inside cards and tables; full ones fill a page. */
  size?: "page" | "compact"
}

/** The base of every empty, error and access state (spec §30.3). */
export function StateView({ icon, title, description, action, size = "compact" }: StateProps) {
  return (
    <Empty className={size === "page" ? "min-h-[60svh]" : "py-12"}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon name={icon} />
        </EmptyMedia>
        <EmptyTitle className={size === "page" ? "text-base" : undefined}>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  )
}

type Presentation = { icon: IconName; title: string; description: string; retry: boolean }

/** Maps any error to what the user sees, by status and code (spec §30.2). Backend internals are never shown. */
export function presentError(error: unknown): Presentation {
  if (!isApiError(error)) {
    return { icon: "error", title: "Something went wrong", description: "An unexpected error occurred. Try again.", retry: true }
  }

  switch (true) {
    case error.code === "network_error":
      return { icon: "error", title: "You appear to be offline", description: error.message, retry: true }
    case error.status === 404:
      return { icon: "search", title: "Not found", description: "This record does not exist or is no longer available.", retry: false }
    case error.status === 403 && error.code === "limit_reached":
      return { icon: "alert", title: "Plan limit reached", description: error.message, retry: false }
    case error.status === 403:
      return { icon: "security", title: "You don't have access", description: "Ask your store owner if you need this page.", retry: false }
    case error.status === 429:
      return {
        icon: "clock",
        title: "Too many requests",
        description: error.retryAfter ? `Please wait ${error.retryAfter} seconds and try again.` : "Please wait a moment and try again.",
        retry: true,
      }
    case error.code === "maintenance":
      return { icon: "settings", title: "Down for maintenance", description: error.message, retry: true }
    case error.status >= 500 || error.code === "upstream_unavailable":
      return { icon: "error", title: "The service is having trouble", description: "This is on our side. Try again in a moment.", retry: true }
    default:
      return { icon: "error", title: "That didn't work", description: error.message, retry: true }
  }
}

/** An error in place of content, with a retry for transient failures and the request ID for support. */
export function ErrorState({ error, onRetry, size }: { error: unknown; onRetry?: () => void; size?: "page" | "compact" }) {
  const p = presentError(error)
  const requestId = isApiError(error) ? error.requestId : null

  return (
    <StateView
      icon={p.icon}
      title={p.title}
      size={size}
      description={
        <>
          {p.description}
          {requestId ? <span className="mt-2 block font-mono text-xs">Reference: {requestId}</span> : null}
        </>
      }
      action={
        p.retry && onRetry ? (
          <Button variant="outline" onClick={onRetry}>
            <Icon name="refresh" data-icon="inline-start" />
            Try again
          </Button>
        ) : undefined
      }
    />
  )
}
