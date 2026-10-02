import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AffiliateDetail } from "@/features/affiliates"

export const metadata: Metadata = { title: "Affiliate" }

export default async function Page({ params }: PageProps<"/affiliates/[affiliate]">) {
  const id = Number((await params).affiliate)
  if (!Number.isInteger(id) || id <= 0) notFound()

  return <AffiliateDetail id={id} />
}
