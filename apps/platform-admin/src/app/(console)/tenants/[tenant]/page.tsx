import type { Metadata } from "next"

import { TenantDetail } from "@/features/tenants"

export const metadata: Metadata = { title: "Tenant" }

export default async function Page({ params }: PageProps<"/tenants/[tenant]">) {
  return <TenantDetail id={decodeURIComponent((await params).tenant)} />
}
