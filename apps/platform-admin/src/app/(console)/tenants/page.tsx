import type { Metadata } from "next"

import { TenantsPage } from "@/features/tenants"

export const metadata: Metadata = { title: "Tenants" }

export default function Page() {
  return <TenantsPage />
}
