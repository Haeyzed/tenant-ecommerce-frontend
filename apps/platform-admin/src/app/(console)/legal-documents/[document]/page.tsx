import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { LegalDetail } from "@/features/legal"

export const metadata: Metadata = { title: "Legal document" }

export default async function Page({ params }: PageProps<"/legal-documents/[document]">) {
  const id = Number((await params).document)
  if (!Number.isInteger(id) || id <= 0) notFound()

  return <LegalDetail id={id} />
}
