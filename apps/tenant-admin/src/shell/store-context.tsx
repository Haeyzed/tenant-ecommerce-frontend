"use client"

import { createContext, useContext, type ReactNode } from "react"

import type { DisplaySettings } from "@workspace/format"

/** Store-wide display context: base currency and the user's date/time settings (spec §34.3). */
export type StoreContextValue = {
  currency: string
  display: DisplaySettings
  storeSlug: string
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({
  value,
  children,
}: {
  value: StoreContextValue
  children: ReactNode
}) {
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreContextValue {
  const value = useContext(StoreContext)
  if (value === null)
    throw new Error("useStore must be used inside <StoreProvider>.")
  return value
}
