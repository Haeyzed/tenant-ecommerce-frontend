import type { Metadata } from "next"

import { DatabaseServersPage } from "@/features/database-servers"

export const metadata: Metadata = { title: "Database servers" }

export default function Page() {
  return <DatabaseServersPage />
}
