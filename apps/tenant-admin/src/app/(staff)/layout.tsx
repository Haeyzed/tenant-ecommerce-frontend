import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"

import { allowedRoutes } from "@workspace/access"
import { visibleNav } from "@workspace/admin-kit/nav"
import { tenantRoutes } from "@workspace/contract/routes/tenant"

import { FullPageState } from "@workspace/admin-kit/auth"
import { toAccessSnapshot } from "@/features/session/me"
import { ShellBanners } from "@/features/session/shell-banners"
import { loadStaffSession, loadStoreBranding } from "@/server/api"
import { navEntries, navGroups } from "@/shell/nav"
import { StaffShell } from "@/shell/staff-shell"

const LogoutButton = () => (
  <form action="/bff/session/expired" method="get">
    <button
      type="submit"
      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
    >
      Sign out
    </button>
  </form>
)

/**
 * The staff area. Loads `me` on the server so the first render is correct,
 * decides the tenant state before the shell (spec §11.4), evaluates the
 * gates and filters the navigation (spec §10, §17).
 */
export default async function StaffLayout({
  children,
}: {
  children: ReactNode
}) {
  const [result, branding, cookieStore] = await Promise.all([
    loadStaffSession(),
    loadStoreBranding(),
    cookies(),
  ])

  if (result.kind === "unknown-host") {
    return (
      <FullPageState
        icon="store"
        title="Store not found"
        description="There is no store at this address."
      />
    )
  }
  if (result.kind === "anonymous") redirect("/login")

  if (result.kind === "error") {
    const { status, code } = result.error
    if (code === "tenant_suspended") {
      return (
        <FullPageState
          icon="security"
          title="This store is suspended"
          description="The platform has suspended this store. Contact platform support to restore access."
          action={<LogoutButton />}
        />
      )
    }
    if (status === 410 || code === "tenant_closed") {
      return (
        <FullPageState
          icon="store"
          title="This store is closed"
          description="The store has been closed and can no longer be managed."
          action={<LogoutButton />}
        />
      )
    }
    if (code === "tenant_provisioning") {
      return (
        <FullPageState
          icon="loading"
          title="Your store is being set up"
          description="This usually takes a minute. Refresh this page shortly."
        />
      )
    }
    if (status === 402) {
      return (
        <FullPageState
          icon="billing"
          title="Payment required"
          description="This store's subscription needs a payment before the admin can be used. The store owner can complete it from the billing link in their email."
          action={<LogoutButton />}
        />
      )
    }
    if (code === "maintenance") {
      return (
        <FullPageState
          icon="settings"
          title="Down for maintenance"
          description={result.error.message}
        />
      )
    }
    return (
      <FullPageState
        icon="error"
        title="We couldn't load your store"
        description="The service is having trouble. Refresh the page in a moment."
      />
    )
  }

  const session = result.session
  const snapshot = toAccessSnapshot(session)
  const groups = visibleNav(navGroups, navEntries, snapshot, tenantRoutes)
  const allowed = allowedRoutes(snapshot, tenantRoutes, ["tenant.admin"])
  const store =
    branding.kind === "ok"
      ? branding.branding
      : {
          name: session.tenant.slug || "Your store",
          logoUrl: null,
          currency: "USD",
        }

  return (
    <StaffShell
      store={{ name: store.name, logoUrl: store.logoUrl }}
      storeContext={{
        currency: store.currency,
        display: session.display,
        storeSlug: session.tenant.slug,
      }}
      user={{ name: session.user.name, email: session.user.email }}
      groups={groups}
      allowedRoutes={allowed}
      modules={session.modules}
      isOwner={session.isOwner}
      defaultOpen={cookieStore.get("sidebar_state")?.value !== "false"}
      banners={<ShellBanners session={session} />}
    >
      {children}
    </StaffShell>
  )
}
