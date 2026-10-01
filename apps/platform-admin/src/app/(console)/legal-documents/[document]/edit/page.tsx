import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { LegalEdit } from "@/features/legal"

export const metadata: Metadata = { title: "Edit legal draft" }

export default async function Page({ params }: PageProps<"/legal-documents/[document]/edit">) {
  const id = Number((await params).document)
  if (!Number.isInteger(id) || id <= 0) notFound()

  return <LegalEdit id={id} />
}
