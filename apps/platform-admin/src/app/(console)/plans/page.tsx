import type { Metadata } from "next"

import { PlansPage } from "@/features/plans"

export const metadata: Metadata = { title: "Plans" }

export default function Page() {
  return <PlansPage />
}
