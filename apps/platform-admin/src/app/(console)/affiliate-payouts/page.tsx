import type { Metadata } from "next"

import { PayoutsPage } from "@/features/affiliates"

export const metadata: Metadata = { title: "Affiliate payouts" }

export default function Page() {
  return <PayoutsPage />
}
