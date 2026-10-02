import type { Metadata } from "next"

import { ReferralsPage } from "@/features/affiliates"

export const metadata: Metadata = { title: "Referrals" }

export default function Page() {
  return <ReferralsPage />
}
