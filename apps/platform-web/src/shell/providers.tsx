"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { useState, type ReactNode } from "react"

import { isRetryable } from "@workspace/api-client"
import { Toaster } from "@workspace/ui/components/toast"

/** Client providers for the website's interactive islands (spec §24.2). */
export function SiteProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: (count, error) => count < 2 && isRetryable(error), refetchOnWindowFocus: false },
          mutations: { retry: false },
        },
      })
  )

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={client}>
        {children}
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
