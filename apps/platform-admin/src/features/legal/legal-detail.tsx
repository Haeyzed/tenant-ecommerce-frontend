"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useState } from "react"

import { useCan } from "@workspace/access/react"
import { ErrorState, StateView } from "@workspace/admin-kit/states"
import { DataTable, type DataColumn } from "@workspace/admin-kit/table"
import { isApiError } from "@workspace/api-client"
import type { operations } from "@workspace/contract/landlord"
import { formatDateTime } from "@workspace/format"
import { Button } from "@workspace/ui/components/button"
import { ButtonLink } from "@workspace/ui/components/button-link"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { toast } from "@workspace/ui/components/toast"
import { Icon } from "@workspace/ui/icons"

import { DetailCard } from "@/features/billing/details"
import { StatusLabel } from "@/features/billing/labels"
import { useConsole } from "@/shell/console-context"

import { acceptancesQuery, legalDocumentQuery, usePublish } from "./api"
import { ACCEPTANCE_CONTEXT, LEGAL_STATUS, typeLabel } from "./labels"

type Acceptance = operations["landlord.legal.acceptances.index"]["responses"][200]["content"]["application/json"]["data"][number]

/** One version: its text, its rules, publishing and who accepted it (spec §25.1). */
export function LegalDetail({ id }: { id: number }) {
  const { display } = useConsole()
  const query = useQuery(legalDocumentQuery(id))
  const publish = usePublish(id)
  const [confirm, setConfirm] = useState(false)
  const [page, setPage] = useState(1)
  const acceptances = useQuery({ ...acceptancesQuery(id, page), placeholderData: keepPreviousData })
  const canEdit = useCan("landlord.legal.update")
  const canPublish = useCan("landlord.legal.publish")
  const canSeeAcceptances = useCan("landlord.legal.acceptances.index")

  if (query.isPending) return <Skeleton className="h-96 w-full" />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} size="page" />

  const d = query.data
  const isDraft = d.status === "draft"

  async function runPublish() {
    try {
      await publish.mutateAsync()
      toast.add({
        title: `${d.title} ${d.version} is now current`,
        description: d.requires_reacceptance ? "Active stores are being asked to accept it." : undefined,
        type: "success",
      })
      setConfirm(false)
    } catch (e) {
      toast.add({ title: "Couldn't publish", description: isApiError(e) && e.code === "invalid_transition" ? "This version is no longer a draft." : undefined, type: "error" })
    }
  }

  const columns: DataColumn<Acceptance>[] = [
    {
      id: "who",
      header: "Accepted by",
      mobile: "title",
      cell: (a) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{a.accepted_by_name}</span>
          <span className="truncate text-xs text-muted-foreground">{a.accepted_by_email}</span>
        </span>
      ),
    },
    { id: "context", header: "When", mobile: "subtitle", cell: (a) => ACCEPTANCE_CONTEXT[a.context] ?? a.context },
    {
      id: "for",
      header: "For",
      mobile: "detail",
      cell: (a) =>
        a.tenant_id ? (
          <Link href={`/tenants/${encodeURIComponent(a.tenant_id)}`} className="underline underline-offset-4">
            Store
          </Link>
        ) : a.affiliate_id ? (
          `Affiliate #${a.affiliate_id}`
        ) : (
          "Sign-up in progress"
        ),
    },
    { id: "at", header: "Accepted", mobile: "meta", cell: (a) => formatDateTime(a.accepted_at, display) },
    { id: "ip", header: "IP address", hideable: true, defaultHidden: true, mobile: "hidden", cell: (a) => <span className="font-mono text-xs">{a.ip_address ?? "—"}</span> },
  ]

  return (
    <>
      <PageHeader
        title={d.title}
        description={`${typeLabel(d.document_type)} · version ${d.version}`}
        meta={<StatusLabel map={LEGAL_STATUS} value={d.status} />}
        actions={
          isDraft ? (
            <>
              {canEdit ? (
                <ButtonLink variant="outline" render={<Link href={`/legal-documents/${d.id}/edit`} />}>
                  <Icon name="edit" data-icon="inline-start" />
                  Edit draft
                </ButtonLink>
              ) : null}
              {canPublish ? <Button onClick={() => setConfirm(true)}>Publish</Button> : null}
            </>
          ) : (
            <ButtonLink variant="outline" render={<Link href={`/legal-documents/new?type=${d.document_type}`} />}>
              New version
            </ButtonLink>
          )
        }
      />

      <Tabs defaultValue="text">
        <TabsList>
          <TabsTrigger value="text">Text</TabsTrigger>
          {canSeeAcceptances && !isDraft ? <TabsTrigger value="acceptances">Acceptances</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="text" className="flex flex-col gap-4 pt-4">
          <DetailCard
            title="Rules"
            details={[
              { term: "Required at sign-up", value: d.required_at_registration ? "Yes" : "No" },
              { term: "Existing stores accept again", value: d.requires_reacceptance ? "Yes" : "No" },
              { term: "Published", value: d.published_at ? formatDateTime(d.published_at, display) : "Not yet" },
              { term: "Effective from", value: d.effective_at ? formatDateTime(d.effective_at, display) : "When published" },
            ]}
          />
          <Card>
            <CardHeader>
              <CardTitle>Text</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-3xl text-sm leading-relaxed whitespace-pre-wrap">{d.body}</div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="acceptances" className="pt-4">
          <DataTable<Acceptance>
            tableId="legal-acceptances"
            columns={columns}
            rows={acceptances.data?.items}
            getRowId={(a) => String(a.id)}
            isLoading={acceptances.isPending}
            isFetching={acceptances.isFetching}
            error={acceptances.error}
            onRetry={() => void acceptances.refetch()}
            filtered={false}
            paging={{ pagination: acceptances.data?.pagination, onPageChange: setPage, onPerPageChange: () => setPage(1) }}
            emptyState={<StateView icon="checklist" title="No acceptances yet" description="Stores that accept this version appear here." />}
            noResultsState={<StateView icon="search" title="No acceptances" description="" />}
          />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Publish ${d.title} ${d.version}?`}
        description={
          <>
            It becomes the current {typeLabel(d.document_type).toLowerCase()} and the previous version is retired. Published versions can&apos;t be changed.
            {d.requires_reacceptance ? " Every active store is asked to accept it." : ""}
          </>
        }
        confirmLabel="Publish"
        pending={publish.isPending}
        onConfirm={() => void runPublish()}
      />
    </>
  )
}
