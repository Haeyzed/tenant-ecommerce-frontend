import type { Metadata } from "next"

import { PageHeader } from "@workspace/ui/components/page-header"

import { DOCUMENT_TYPES, LegalForm } from "@/features/legal"

export const metadata: Metadata = { title: "New legal version" }

export default async function Page({ searchParams }: PageProps<"/legal-documents/new">) {
  const { type } = await searchParams
  const initialType = DOCUMENT_TYPES.find((t) => t === type) ?? null

  return (
    <>
      <PageHeader title="New version" description="Starts as a draft. Publish it to make it the current version." />
      <LegalForm doc={null} initialType={initialType} />
    </>
  )
}
