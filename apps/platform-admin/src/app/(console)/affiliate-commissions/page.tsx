import type { Metadata } from "next"

import { AffiliateCommissionsPage } from "@/features/affiliates"

export const metadata: Metadata = { title: "Affiliate commissions" }

export default function Page() {
  return <AffiliateCommissionsPage />
}
