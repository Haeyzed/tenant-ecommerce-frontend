import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { TransactionDetail } from "@/features/payment-transactions"

export const metadata: Metadata = { title: "Transaction" }

export default async function Page({ params }: PageProps<"/payment-transactions/[transaction]">) {
  const id = Number((await params).transaction)
  if (!Number.isInteger(id) || id <= 0) notFound()

  return <TransactionDetail id={id} />
}
