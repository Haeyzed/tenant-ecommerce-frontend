"use client"

import { useQuery } from "@tanstack/react-query"

import { EntityCombobox } from "@workspace/admin-kit/lookup"
import { unwrap, unwrapPage } from "@workspace/api-client"

import { api } from "@/shell/api-client"

export type TenantOption = { id: string; name: string; slug: string }

async function searchTenants(term: string, signal: AbortSignal): Promise<TenantOption[]> {
  const page = await unwrapPage(api.GET("/admin/tenants", { params: { query: { search: term || undefined, per_page: 20 } }, signal }))
  return page.items.map((t) => ({ id: t.id, name: t.name, slug: t.slug }))
}

/**
 * A tenant picker for list filters: searches tenants by name as you type
 * and keeps only the tenant id in the URL. When a page opens with an id
 * already in the URL, the tenant's name is loaded so the filter shows it.
 */
export function TenantFilter({
  value,
  onChange,
  className,
}: {
  value: string | null
  onChange: (tenantId: string | null) => void
  className?: string
}) {
  const selected = useQuery({
    queryKey: ["tenants", "detail", value, "summary"],
    queryFn: async ({ signal }): Promise<TenantOption> => {
      const data = await unwrap(api.GET("/admin/tenants/{tenant}", { params: { path: { tenant: value ?? "" } }, signal }))
      return { id: data.tenant.id, name: data.tenant.name, slug: data.tenant.slug }
    },
    enabled: value !== null,
    staleTime: 5 * 60_000,
  })

  const current: TenantOption | null = value === null ? null : (selected.data ?? { id: value, name: selected.isPending ? "Loading…" : value, slug: "" })

  return (
    <div className={className}>
      <EntityCombobox<TenantOption>
        queryKey={["lookup-search", "tenants"]}
        search={searchTenants}
        value={current}
        onChange={(tenant) => onChange(tenant?.id ?? null)}
        getId={(t) => t.id}
        getLabel={(t) => t.name}
        getDescription={(t) => t.slug || null}
        placeholder="Any tenant"
        emptyText="No tenants match"
      />
    </div>
  )
}
