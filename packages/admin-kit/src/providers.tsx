"use client"

import { useRouter } from "next/navigation"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { useEffect, type ReactNode } from "react"

import { Toaster } from "@workspace/ui/components/toast"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

import { QueryProvider } from "./query"

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT"
}

/** "d" toggles the theme outside form fields. */
function ThemeHotkey() {
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key.toLowerCase() !== "d" || isTypingTarget(event.target)) return
      setTheme(resolvedTheme === "dark" ? "light" : "dark")
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [resolvedTheme, setTheme])

  return null
}

/**
 * App-wide client providers for every admin app: theme (light, dark,
 * system), URL state, the query cache, tooltips and toasts. A 401 anywhere
 * sends the user through /bff/session/expired to login; an access error
 * re-renders the server layout so gates are recomputed (spec §10.2).
 */
export function AdminProviders({ children }: { children: ReactNode }) {
  const router = useRouter()

  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ThemeHotkey />
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
    </NextThemesProvider>
  )
}
