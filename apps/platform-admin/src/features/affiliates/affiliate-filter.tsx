"use client"

import { useQuery } from "@tanstack/react-query"

import { EntityCombobox } from "@workspace/admin-kit/lookup"
import { unwrap, unwrapPage } from "@workspace/api-client"

import { api } from "@/shell/api-client"

type AffiliateOption = { id: number; name: string; code: string | null }

async function searchAffiliates(term: string, signal: AbortSignal): Promise<AffiliateOption[]> {
  const page = await unwrapPage(api.GET("/admin/affiliates", { params: { query: { search: term || undefined, per_page: 20 } }, signal }))
  return page.items.flatMap((a) => (a.id === undefined ? [] : [{ id: a.id, name: a.name, code: a.referral_code }]))
}

/**
 * An affiliate picker for list filters: searches by name, email or code as
 * you type and keeps only the id in the URL; the name of an id already in
 * the URL is loaded so the filter shows it.
 */
export function AffiliateFilter({ value, onChange, className }: { value: number | null; onChange: (id: number | null) => void; className?: string }) {
  const selected = useQuery({
    queryKey: ["affiliates", "detail", value, "summary"],
    queryFn: async ({ signal }): Promise<AffiliateOption> => {
      const data = await unwrap(api.GET("/admin/affiliates/{affiliate}", { params: { path: { affiliate: value ?? 0 } }, signal }))
      return { id: value ?? 0, name: data.affiliate.name, code: data.affiliate.referral_code }
    },
    enabled: value !== null,
    staleTime: 5 * 60_000,
  })

  const current: AffiliateOption | null =
    value === null ? null : (selected.data ?? { id: value, name: selected.isPending ? "Loading…" : `Affiliate #${value}`, code: null })

  return (
    <div className={className}>
      <EntityCombobox<AffiliateOption>
        queryKey={["lookup-search", "affiliates"]}
        search={searchAffiliates}
        value={current}
        onChange={(a) => onChange(a?.id ?? null)}
        getId={(a) => String(a.id)}
        getLabel={(a) => a.name}
        getDescription={(a) => a.code}
        placeholder="Any affiliate"
        emptyText="No affiliates match"
      />
    </div>
  )
}
