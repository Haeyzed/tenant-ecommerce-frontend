import type { Metadata } from "next"

import { DashboardPage } from "@/features/dashboard"
import { loadStaffSession } from "@/server/api"

export const metadata: Metadata = { title: "Dashboard" }

export default async function Page() {
  const result = await loadStaffSession()
  return (
    <DashboardPage
      userName={result.kind === "ok" ? result.session.user.name : ""}
    />
  )
}
