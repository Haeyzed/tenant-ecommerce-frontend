import type { Metadata } from "next"

import { AffiliatesPage } from "@/features/affiliates"

export const metadata: Metadata = { title: "Affiliates" }

export default function Page() {
  return <AffiliatesPage />
}
