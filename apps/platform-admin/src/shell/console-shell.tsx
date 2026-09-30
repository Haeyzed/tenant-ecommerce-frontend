"use client"

import { useQueryClient } from "@tanstack/react-query"
import type { ReactNode } from "react"

import { AccessProvider } from "@workspace/access/react"
import { SessionKeeper } from "@workspace/admin-kit/auth"
import type { VisibleGroup } from "@workspace/admin-kit/nav"
import { AppShell } from "@workspace/admin-kit/shell"
import type { DisplaySettings } from "@workspace/format"

import { ConsoleProvider } from "./console-context"

type Props = {
  brand: { name: string; logoUrl: string | null }
  user: { name: string; email: string }
  groups: VisibleGroup[]
  allowedRoutes: string[]
  display: DisplaySettings
  defaultOpen: boolean
  children: ReactNode
}

/** The platform console shell: gated navigation, session keeper, user menu. */
export function ConsoleShell({ brand, user, groups, allowedRoutes, display, defaultOpen, children }: Props) {
  const queryClient = useQueryClient()

  async function logout() {
    await fetch("/bff/auth/logout", { method: "POST", headers: { "X-Requested-With": "bff" } }).catch(() => undefined)
    queryClient.clear()
    new BroadcastChannel("session:platform").postMessage("logout")
    window.location.assign("/login")
  }

  return (
    <ConsoleProvider display={display}>
      <AccessProvider allowedRoutes={allowedRoutes} modules={{}} isOwner={false}>
        <SessionKeeper app="platform-admin" actor="platform" />
        <AppShell
          brand={{ name: brand.name, subtitle: "Platform console", logoUrl: brand.logoUrl }}
          groups={groups}
          user={user}
          onLogout={logout}
          defaultOpen={defaultOpen}
          homeHref="/dashboard"
        >
          {children}
        </AppShell>
      </AccessProvider>
    </ConsoleProvider>
  )
}
