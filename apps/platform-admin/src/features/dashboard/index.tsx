"use client"

import { SectionDashboard, normalizeSection, normalizeSections, type DashboardQuery, type SectionSummary } from "@workspace/admin-kit/dashboard"
import { unwrap } from "@workspace/api-client"

import { api } from "@/shell/api-client"
import { useConsole } from "@/shell/console-context"

import { TestModeNotice } from "./test-mode-notice"

export { dashboardNav } from "./nav"

async function loadSections(signal: AbortSignal): Promise<SectionSummary[]> {
  return normalizeSections(await unwrap(api.GET("/admin/dashboard", { signal })))
}

async function loadSection(key: string, query: DashboardQuery, signal: AbortSignal) {
  return normalizeSection(await unwrap(api.GET("/admin/dashboard/{section}", { params: { path: { section: key }, query }, signal })))
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
      before={<TestModeNotice />}
      display={display}
    />
  )
}
