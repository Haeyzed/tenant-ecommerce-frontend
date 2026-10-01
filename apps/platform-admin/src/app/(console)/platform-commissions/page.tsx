import type { Metadata } from "next"

import { CommissionsPage } from "@/features/commissions"

export const metadata: Metadata = { title: "Commissions" }

export default function Page() {
  return <CommissionsPage />
}
