import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { SubscriptionDetail } from "@/features/subscriptions"

export const metadata: Metadata = { title: "Subscription" }

export default async function Page({ params }: PageProps<"/subscriptions/[subscription]">) {
  const id = Number((await params).subscription)
  if (!Number.isInteger(id) || id <= 0) notFound()

  return <SubscriptionDetail id={id} />
}
