import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PlanEditor } from "@/features/plans"

export const metadata: Metadata = { title: "Plan" }

export default async function Page({ params }: PageProps<"/plans/[plan]">) {
  const id = Number((await params).plan)
  if (!Number.isInteger(id) || id <= 0) notFound()

  return <PlanEditor planId={id} />
}
