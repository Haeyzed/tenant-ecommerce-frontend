"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { parseAsInteger, parseAsStringLiteral, useQueryStates } from "nuqs"
import { useMemo } from "react"

import { useCan } from "@workspace/access/react"
import { StateView } from "@workspace/admin-kit/states"
import { DataTable, FilterSelect, type DataColumn } from "@workspace/admin-kit/table"
import { formatDate } from "@workspace/format"
import { ButtonLink } from "@workspace/ui/components/button-link"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Icon } from "@workspace/ui/icons"

import { StatusLabel, labelOf } from "@/features/billing/labels"
import { useConsole } from "@/shell/console-context"

import { DOCUMENT_TYPES, LEGAL_STATUSES, legalDocumentsQuery, type LegalDocument } from "./api"
import { LEGAL_STATUS, typeLabel } from "./labels"

const params = {
  type: parseAsStringLiteral(DOCUMENT_TYPES),
  status: parseAsStringLiteral(LEGAL_STATUSES),
  page: parseAsInteger.withDefault(1),
  per_page: parseAsInteger.withDefault(25),
}

/** Terms, privacy and other agreements, by version (spec §25.1, §11.6). */
export function LegalPage() {
  const { display } = useConsole()
  const [filters, setFilters] = useQueryStates(params, { clearOnDefault: true, history: "replace" })
  const canCreate = useCan("landlord.legal.store")

  const query = useQuery({
    ...legalDocumentsQuery({
      document_type: filters.type ?? undefined,
      status: filters.status ?? undefined,
      page: filters.page,
      per_page: filters.per_page,
    }),
    placeholderData: keepPreviousData,
  })

  const columns = useMemo<DataColumn<LegalDocument>[]>(
    () => [
      {
        id: "doc",
        header: "Document",
        mobile: "title",
        cell: (d) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{d.title}</span>
            <span className="truncate text-xs text-muted-foreground">{typeLabel(d.document_type)}</span>
          </span>
        ),
      },
      { id: "version", header: "Version", mobile: "subtitle", cell: (d) => <span className="font-mono text-xs">{d.version}</span> },
      { id: "status", header: "Status", mobile: "meta", cell: (d) => <StatusLabel map={LEGAL_STATUS} value={d.status} /> },
      {
        id: "rules",
        header: "Applies",
        mobile: "detail",
        cell: (d) => [d.required_at_registration ? "At sign-up" : null, d.requires_reacceptance ? "Re-acceptance" : null].filter(Boolean).join(" · ") || "—",
      },
      { id: "published", header: "Published", mobile: "detail", cell: (d) => (d.published_at ? formatDate(d.published_at, display) : "—") },
    ],
    [display]
  )

  return (
    <>
      <PageHeader
        title="Legal documents"
        description="Each document has versions. Publishing a draft makes it current and retires the previous version; published versions can't be changed."
        actions={
          canCreate ? (
            <ButtonLink render={<Link href="/legal-documents/new" />}>
              <Icon name="add" data-icon="inline-start" />
              New version
            </ButtonLink>
          ) : null
        }
      />
      <DataTable<LegalDocument>
        tableId="legal-documents"
        columns={columns}
        rows={query.data?.items}
        getRowId={(d) => String(d.id)}
        rowHref={(d) => `/legal-documents/${d.id}`}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        filtered={Boolean(filters.type || filters.status)}
        paging={{
          pagination: query.data?.pagination,
          onPageChange: (page) => void setFilters({ page }),
          onPerPageChange: (per_page) => void setFilters({ per_page, page: 1 }),
        }}
        toolbar={
          <>
            <FilterSelect
              label="Document"
              anyLabel="Every document"
              value={filters.type}
              options={DOCUMENT_TYPES.map((t) => ({ value: t, label: typeLabel(t) }))}
              onChange={(type) => void setFilters({ type, page: 1 })}
              className="sm:w-60"
            />
            <FilterSelect
              label="Status"
              anyLabel="Any status"
              value={filters.status}
              options={LEGAL_STATUSES.map((s) => ({ value: s, label: labelOf(LEGAL_STATUS, s) }))}
              onChange={(status) => void setFilters({ status, page: 1 })}
            />
          </>
        }
        emptyState={<StateView icon="file" title="No legal documents" description="Create the terms and privacy policy stores accept at sign-up." />}
        noResultsState={<StateView icon="search" title="No documents match" description="Try another document or status." />}
      />
    </>
  )
}
