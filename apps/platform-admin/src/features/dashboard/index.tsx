"use client"

import { SectionDashboard, normalizeSection, type DashboardRange, type SectionSummary } from "@workspace/admin-kit/dashboard"
import { unwrap } from "@workspace/api-client"

import { api } from "@/shell/api-client"
import { useConsole } from "@/shell/console-context"

export { dashboardNav } from "./nav"

async function loadSections(signal: AbortSignal): Promise<SectionSummary[]> {
  const data = await unwrap(api.GET("/admin/dashboard", { signal }))
  const sections = (data as { sections?: unknown }).sections
  return Array.isArray(sections) ? (sections as SectionSummary[]) : []
}

async function loadSection(key: string, range: DashboardRange, signal: AbortSignal) {
  return normalizeSection(await unwrap(api.GET("/admin/dashboard/{section}", { params: { path: { section: key }, query: { range } }, signal })))
}

/** The platform dashboard (spec §22.1): the backend's sections for this user's role. */
export function PlatformDashboardPage({ userName }: { userName: string }) {
  const { display } = useConsole()

  return (
    <SectionDashboard
      title={`Welcome back, ${userName.split(" ")[0] || userName}`}
      description="Platform revenue, tenants, subscriptions and affiliates at a glance."
      loadSections={loadSections}
      loadSection={loadSection}
      display={display}
    />
  )
}
