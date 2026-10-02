import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PayoutDetail } from "@/features/affiliates"

export const metadata: Metadata = { title: "Affiliate payout" }

export default async function Page({ params }: PageProps<"/affiliate-payouts/[payout]">) {
  const id = Number((await params).payout)
  if (!Number.isInteger(id) || id <= 0) notFound()

  return <PayoutDetail id={id} />
}
