"use client"

import { useRouter } from "next/navigation"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import type { ReactNode } from "react"

import { QueryProvider } from "@workspace/admin-kit/query"
import { Toaster } from "@workspace/ui/components/toast"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

import { ThemeProvider } from "@/components/theme-provider"

/**
 * App-wide client providers. A 401 anywhere sends the user through
 * /bff/session/expired to login; an access error re-renders the server
 * layout so the snapshot and navigation are recomputed (spec §10.2).
 */
export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter()

  return (
    <ThemeProvider>
      <NuqsAdapter>
        <QueryProvider
          onUnauthenticated={() => {
            const next = window.location.pathname + window.location.search
            window.location.assign(`/bff/session/expired?next=${encodeURIComponent(next)}`)
          }}
          onAccessChanged={() => router.refresh()}
        >
          <TooltipProvider>
            <Toaster>{children}</Toaster>
          </TooltipProvider>
        </QueryProvider>
      </NuqsAdapter>
    </ThemeProvider>
  )
}
