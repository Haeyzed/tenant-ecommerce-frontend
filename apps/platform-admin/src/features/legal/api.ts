"use client"

import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"

import { unwrap, unwrapPage } from "@workspace/api-client"
import type { components, operations } from "@workspace/contract/landlord"

import { api } from "@/shell/api-client"

export type LegalDocument = components["schemas"]["LegalDocumentResource"]
export type LegalFilters = NonNullable<operations["landlord.legal.index"]["parameters"]["query"]>
export type DraftBody = operations["landlord.legal.store"]["requestBody"]["content"]["application/json"]
export type DocumentType = DraftBody["document_type"]

export const DOCUMENT_TYPES: readonly DocumentType[] = ["terms_of_service", "privacy_policy", "data_processing_agreement", "acceptable_use_policy", "affiliate_agreement"]
export const LEGAL_STATUSES = ["draft", "published", "retired"] as const

export const legalKeys = {
  all: ["legal-documents"] as const,
  list: (filters: LegalFilters) => [...legalKeys.all, "list", filters] as const,
  detail: (id: number) => [...legalKeys.all, "detail", id] as const,
  acceptances: (id: number, page: number) => [...legalKeys.all, "detail", id, "acceptances", page] as const,
}

export const legalDocumentsQuery = (filters: LegalFilters) =>
  queryOptions({
    queryKey: legalKeys.list(filters),
    queryFn: ({ signal }) => unwrapPage(api.GET("/admin/legal-documents", { params: { query: filters }, signal })),
  })

export const legalDocumentQuery = (id: number) =>
  queryOptions({
    queryKey: legalKeys.detail(id),
    queryFn: ({ signal }) => unwrap(api.GET("/admin/legal-documents/{document}", { params: { path: { document: id } }, signal })),
  })

export const acceptancesQuery = (id: number, page: number) =>
  queryOptions({
    queryKey: legalKeys.acceptances(id, page),
    queryFn: ({ signal }) =>
      unwrapPage(api.GET("/admin/legal-documents/{document}/acceptances", { params: { path: { document: id }, query: { page, per_page: 20 } }, signal })),
  })

function useRefresh() {
  const client = useQueryClient()
  return () => void client.invalidateQueries({ queryKey: legalKeys.all })
}

export function useSaveDraft(id: number | null) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async (body: DraftBody) =>
      id === null
        ? unwrap(api.POST("/admin/legal-documents", { body }))
        : unwrap(api.PATCH("/admin/legal-documents/{document}", { params: { path: { document: id } }, body: { ...body, document_type: undefined } })),
    onSuccess: refresh,
  })
}

export function usePublish(id: number) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async () => unwrap(api.POST("/admin/legal-documents/{document}/publish", { params: { path: { document: id } } })),
    onSuccess: refresh,
  })
}
