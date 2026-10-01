import type { Metadata } from "next"

import { LegalPage } from "@/features/legal"

export const metadata: Metadata = { title: "Legal documents" }

export default function Page() {
  return <LegalPage />
}
