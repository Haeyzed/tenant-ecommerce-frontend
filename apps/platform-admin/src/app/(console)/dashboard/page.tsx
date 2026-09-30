import type { Metadata } from "next"

import { PlatformDashboardPage } from "@/features/dashboard"
import { loadPlatformSession } from "@/server/api"

export const metadata: Metadata = { title: "Dashboard" }

export default async function Page() {
  const result = await loadPlatformSession()
  return <PlatformDashboardPage userName={result.kind === "ok" ? result.session.user.name : ""} />
}
