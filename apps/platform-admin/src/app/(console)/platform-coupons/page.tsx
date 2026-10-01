import type { Metadata } from "next"

import { CouponsPage } from "@/features/coupons"

export const metadata: Metadata = { title: "Coupons" }

export default function Page() {
  return <CouponsPage />
}
