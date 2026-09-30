"use client"

import { createContext, useContext, type ReactNode } from "react"

import type { DisplaySettings } from "@workspace/format"

/** The platform user's date and time display settings (spec §34.3). */
const ConsoleContext = createContext<{ display: DisplaySettings } | null>(null)

export function ConsoleProvider({ display, children }: { display: DisplaySettings; children: ReactNode }) {
  return <ConsoleContext.Provider value={{ display }}>{children}</ConsoleContext.Provider>
}

export function useConsole() {
  const value = useContext(ConsoleContext)
  if (value === null) throw new Error("useConsole must be used inside <ConsoleProvider>.")
  return value
}
