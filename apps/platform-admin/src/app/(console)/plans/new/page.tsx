import type { Metadata } from "next"

import { PageHeader } from "@workspace/ui/components/page-header"

import { PlanForm } from "@/features/plans"

export const metadata: Metadata = { title: "New plan" }

export default function Page() {
  return (
    <>
      <PageHeader title="New plan" description="Name the plan first. It stays inactive until you add prices and activate it." />
      <PlanForm plan={null} />
    </>
  )
}
