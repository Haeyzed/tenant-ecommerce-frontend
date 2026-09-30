"use client"

import { useQueryClient } from "@tanstack/react-query"
import type { ReactNode } from "react"

import type { ModuleState } from "@workspace/access"
import { AccessProvider } from "@workspace/access/react"
import type { VisibleGroup } from "@workspace/admin-kit/nav"
import { AppShell } from "@workspace/admin-kit/shell"

import { SessionKeeper } from "@workspace/admin-kit/auth"
import { StoreProvider, type StoreContextValue } from "@/shell/store-context"

type Props = {
  store: { name: string; logoUrl: string | null }
  storeContext: StoreContextValue
  user: { name: string; email: string }
  groups: VisibleGroup[]
  allowedRoutes: string[]
  modules: Record<string, ModuleState>
  isOwner: boolean
  defaultOpen: boolean
  banners: ReactNode
  children: ReactNode
}

export function StaffShell({
  store,
  storeContext,
  user,
  groups,
  allowedRoutes,
  modules,
  isOwner,
  defaultOpen,
  banners,
  children,
}: Props) {
  const queryClient = useQueryClient()

  async function logout() {
    await fetch("/bff/auth/logout", {
      method: "POST",
      headers: { "X-Requested-With": "bff" },
    }).catch(() => undefined)
    queryClient.clear()
    new BroadcastChannel("session:staff").postMessage("logout")
    window.location.assign("/login")
  }

  return (
    <StoreProvider value={storeContext}>
      <AccessProvider
        allowedRoutes={allowedRoutes}
        modules={modules}
        isOwner={isOwner}
      >
        <SessionKeeper app="tenant-admin" actor="staff" />
        <AppShell
          brand={{
            name: store.name,
            subtitle: "Store admin",
            logoUrl: store.logoUrl,
          }}
          groups={groups}
          user={user}
          onLogout={logout}
          defaultOpen={defaultOpen}
          banners={banners}
        >
          {children}
        </AppShell>
      </AccessProvider>
    </StoreProvider>
  )
}
