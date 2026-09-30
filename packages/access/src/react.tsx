"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"

import type { ModuleState } from "./index"

/**
 * The client side of the access snapshot. The server layout evaluates
 * `canRoute` over the full route manifest and sends only the allowed route
 * names, so the manifest never ships to the browser (spec §10.3).
 */
type AccessValue = {
  allowed: ReadonlySet<string>
  modules: Readonly<Record<string, ModuleState>>
  isOwner: boolean
}

const AccessContext = createContext<AccessValue | null>(null)

export function AccessProvider({
  allowedRoutes,
  modules,
  isOwner,
  children,
}: {
  allowedRoutes: readonly string[]
  modules: Readonly<Record<string, ModuleState>>
  isOwner: boolean
  children: ReactNode
}) {
  const value = useMemo(
    () => ({ allowed: new Set(allowedRoutes), modules, isOwner }),
    [allowedRoutes, modules, isOwner]
  )
  return (
    <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
  )
}

export function useAccess(): AccessValue {
  const value = useContext(AccessContext)
  if (value === null)
    throw new Error("useAccess must be used inside <AccessProvider>.")
  return value
}

/** Whether the current user can call a Laravel route (spec §10.3). */
export function useCan(route: string): boolean {
  return useAccess().allowed.has(route)
}

/** Renders children only when the route is callable; otherwise the fallback (default nothing). */
export function Can({
  route,
  children,
  fallback = null,
}: {
  route: string
  children: ReactNode
  fallback?: ReactNode
}) {
  return useCan(route) ? <>{children}</> : <>{fallback}</>
}
