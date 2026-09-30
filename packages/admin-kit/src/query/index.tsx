"use client"

import {
  isServer,
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import { useState, type ReactNode } from "react"

import { isApiError, isRetryable } from "@workspace/api-client"

type Handlers = {
  /** A 401 on any request: the session ended (spec §12.3 sessionRetry). */
  onUnauthenticated?: () => void
  /** A 403 module error or `forbidden`: refetch the access snapshot (spec §10.2). */
  onAccessChanged?: () => void
}

/** Freshness defaults of spec §14.3: lists 30 s, gc 10 minutes, no background polling. */
export function makeQueryClient(handlers: Handlers = {}) {
  const onError = (error: unknown) => {
    if (!isApiError(error)) return
    if (error.status === 401) handlers.onUnauthenticated?.()
    if (
      error.status === 403 &&
      (error.code === "forbidden" ||
        error.code.startsWith("module_") ||
        error.code === "feature_unavailable")
    ) {
      handlers.onAccessChanged?.()
    }
  }

  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        refetchIntervalInBackground: false,
        // Twice, with backoff, only for transient failures (spec §12.5).
        retry: (failureCount, error) => failureCount < 2 && isRetryable(error),
        retryDelay: (attempt, error) =>
          isApiError(error) && error.retryAfter !== null
            ? error.retryAfter * 1000
            : Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: { retry: false },
    },
  })
}

let browserClient: QueryClient | undefined

export function QueryProvider({
  children,
  ...handlers
}: Handlers & { children: ReactNode }) {
  // One client per browser session; a new one per server request.
  const [client] = useState(() => {
    if (isServer) return makeQueryClient()
    browserClient ??= makeQueryClient(handlers)
    return browserClient
  })

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
