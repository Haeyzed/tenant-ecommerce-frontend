"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"

import { ErrorState, StateView } from "@workspace/admin-kit/states"
import { ButtonLink } from "@workspace/ui/components/button-link"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { legalDocumentQuery } from "./api"
import { LegalForm } from "./legal-form"

/** Loads a draft, then edits it with the shared form; published versions are read-only. */
export function LegalEdit({ id }: { id: number }) {
  const query = useQuery(legalDocumentQuery(id))

  if (query.isPending) return <Skeleton className="h-96 w-full" />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} size="page" />

  const d = query.data
  if (d.status !== "draft") {
    return (
      <StateView
        icon="file"
        title="This version can't be edited"
        description="Published and retired versions stay exactly as stores accepted them. Create a new version instead."
        action={
          <ButtonLink render={<Link href={`/legal-documents/new?type=${d.document_type}`} />}>New version</ButtonLink>
        }
      />
    )
  }

  return (
    <>
      <PageHeader title={`Edit ${d.title} ${d.version}`} description="Drafts can change until they are published." />
      <LegalForm key={d.id} doc={d} />
    </>
  )
}
