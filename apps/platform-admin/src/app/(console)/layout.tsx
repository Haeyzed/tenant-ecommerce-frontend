import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"

import { allowedRoutes } from "@workspace/access"
import { FullPageState } from "@workspace/admin-kit/auth"
import { visibleNav } from "@workspace/admin-kit/nav"
import { landlordRoutes } from "@workspace/contract/routes/landlord"

import { toAccessSnapshot } from "@/features/session/me"
import { loadBranding, loadPlatformSession } from "@/server/api"
import { ConsoleShell } from "@/shell/console-shell"
import { navEntries, navGroups } from "@/shell/nav"

/**
 * The platform console. Loads `me` on the server, evaluates the gates over
 * the landlord manifest and filters the navigation (spec §10, §25.2).
 */
export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const [result, branding, cookieStore] = await Promise.all([loadPlatformSession(), loadBranding(), cookies()])

  if (result.kind === "anonymous") redirect("/login")
  if (result.kind === "error") {
    return result.error.code === "maintenance" ? (
      <FullPageState icon="settings" title="Down for maintenance" description={result.error.message} />
    ) : (
      <FullPageState icon="error" title="We couldn't load the console" description="The service is having trouble. Refresh the page in a moment." />
    )
  }

  const session = result.session
  const snapshot = toAccessSnapshot(session)

  return (
    <ConsoleShell
      brand={branding}
      user={{ name: session.user.name, email: session.user.email }}
      groups={visibleNav(navGroups, navEntries, snapshot, landlordRoutes)}
      allowedRoutes={allowedRoutes(snapshot, landlordRoutes, ["landlord.admin"])}
      display={session.display}
      defaultOpen={cookieStore.get("sidebar_state")?.value !== "false"}
    >
      {children}
    </ConsoleShell>
  )
}
