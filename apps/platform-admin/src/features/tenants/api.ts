"use client"

import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"

import { normalizeKpis } from "@workspace/admin-kit/dashboard"
import { unwrap, unwrapPage } from "@workspace/api-client"
import type { components, operations } from "@workspace/contract/landlord"

import { api } from "@/shell/api-client"

export type Tenant = components["schemas"]["TenantResource"]
export type TenantFilters = NonNullable<operations["landlord.tenancy.tenants.index"]["parameters"]["query"]>
type ShowData = operations["landlord.tenancy.tenants.show"]["responses"][200]["content"]["application/json"]["data"]
export type TenantDetails = ShowData
export type TenantModule = ShowData["modules"][number]
export type FeatureOverride = operations["landlord.plans.tenant-features.index"]["responses"][200]["content"]["application/json"]["data"][number]
export type LimitOverride = operations["landlord.plans.tenant-limit-overrides.index"]["responses"][200]["content"]["application/json"]["data"][number]
export type FeatureOverrideBody = operations["landlord.plans.tenant-features.store"]["requestBody"]["content"]["application/json"]
export type LimitOverrideBody = operations["landlord.plans.tenant-limit-overrides.update"]["requestBody"]["content"]["application/json"]

export const TENANT_STATUSES = ["awaiting_payment", "provisioning", "provisioning_failed", "active", "suspended", "closed", "purged"] as const

export const tenantKeys = {
  all: ["tenants"] as const,
  list: (filters: TenantFilters) => [...tenantKeys.all, "list", filters] as const,
  detail: (id: string) => [...tenantKeys.all, "detail", id] as const,
  features: (id: string) => [...tenantKeys.all, "detail", id, "features"] as const,
  limits: (id: string) => [...tenantKeys.all, "detail", id, "limits"] as const,
  settings: (id: string) => [...tenantKeys.all, "detail", id, "settings"] as const,
  metrics: () => [...tenantKeys.all, "metrics"] as const,
}

export const tenantsQuery = (filters: TenantFilters) =>
  queryOptions({
    queryKey: tenantKeys.list(filters),
    queryFn: ({ signal }) => unwrapPage(api.GET("/admin/tenants", { params: { query: filters }, signal })),
  })

export const tenantQuery = (id: string) =>
  queryOptions({
    queryKey: tenantKeys.detail(id),
    queryFn: ({ signal }) => unwrap(api.GET("/admin/tenants/{tenant}", { params: { path: { tenant: id } }, signal })),
  })

export const tenantMetricsQuery = queryOptions({
  queryKey: tenantKeys.metrics(),
  queryFn: async ({ signal }) => normalizeKpis(await unwrap(api.GET("/admin/tenants/metrics", { signal }))),
  staleTime: 2 * 60_000,
})

export const featureOverridesQuery = (id: string) =>
  queryOptions({
    queryKey: tenantKeys.features(id),
    queryFn: ({ signal }) => unwrap(api.GET("/admin/tenants/{tenant}/features", { params: { path: { tenant: id } }, signal })),
  })

export const limitOverridesQuery = (id: string) =>
  queryOptions({
    queryKey: tenantKeys.limits(id),
    queryFn: ({ signal }) => unwrap(api.GET("/admin/tenants/{tenant}/limit-overrides", { params: { path: { tenant: id } }, signal })),
  })

export const tenantSettingsQuery = (id: string) =>
  queryOptions({
    queryKey: tenantKeys.settings(id),
    queryFn: ({ signal }) => unwrap(api.GET("/admin/tenants/{tenant}/settings", { params: { path: { tenant: id } }, signal })),
  })

/** Any tenant change can move its state, modules and limits: refresh it all in the background. */
function useRefreshTenant() {
  const client = useQueryClient()
  return () => void client.invalidateQueries({ queryKey: tenantKeys.all })
}

export type LifecycleAction = "suspend" | "reactivate" | "close" | "restore" | "export"

export function useTenantAction(id: string) {
  const refresh = useRefreshTenant()
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ action, reason }: { action: LifecycleAction; reason?: string }) => {
      const path = { params: { path: { tenant: id } } }
      switch (action) {
        case "suspend":
          return unwrap(api.POST("/admin/tenants/{tenant}/suspend", { ...path, body: { reason: reason ?? null } }))
        case "reactivate":
          return unwrap(api.POST("/admin/tenants/{tenant}/reactivate", path))
        case "close":
          return unwrap(api.POST("/admin/tenants/{tenant}/close", { ...path, body: { reason: reason ?? "" } }))
        case "restore":
          return unwrap(api.POST("/admin/tenants/{tenant}/restore", path))
        case "export":
          await unwrap(api.POST("/admin/tenants/{tenant}/export", path))
          return null
      }
    },
    onSuccess: (tenant) => {
      // The lifecycle routes return the tenant: show its new status at once.
      if (tenant) client.setQueryData<TenantDetails>(tenantKeys.detail(id), (d) => (d ? { ...d, tenant } : d))
      refresh()
    },
  })
}

export function useSetFeatureOverride(id: string) {
  const refresh = useRefreshTenant()
  return useMutation({
    mutationFn: async (body: FeatureOverrideBody) => unwrap(api.POST("/admin/tenants/{tenant}/features", { params: { path: { tenant: id } }, body })),
    onSuccess: refresh,
  })
}

export function useRemoveFeatureOverride(id: string) {
  const refresh = useRefreshTenant()
  return useMutation({
    mutationFn: async (featureKey: string) =>
      unwrap(api.DELETE("/admin/tenants/{tenant}/features/{featureKey}", { params: { path: { tenant: id, featureKey } } })),
    onSuccess: refresh,
  })
}

export function useSetLimitOverride(id: string) {
  const refresh = useRefreshTenant()
  return useMutation({
    mutationFn: async (body: LimitOverrideBody) => unwrap(api.PATCH("/admin/tenants/{tenant}/limit-overrides", { params: { path: { tenant: id } }, body })),
    onSuccess: refresh,
  })
}

export function useRemoveLimitOverride(id: string) {
  const refresh = useRefreshTenant()
  return useMutation({
    mutationFn: async (limitKey: string) =>
      unwrap(api.DELETE("/admin/tenants/{tenant}/limit-overrides/{limitKey}", { params: { path: { tenant: id, limitKey } } })),
    onSuccess: refresh,
  })
}

export function useUpdateTenantSettings(id: string) {
  const refresh = useRefreshTenant()
  return useMutation({
    mutationFn: async (values: { commission_rate: string | null }) =>
      unwrap(api.PATCH("/admin/tenants/{tenant}/settings", { params: { path: { tenant: id } }, body: { values } })),
    onSuccess: refresh,
  })
}

/** Which lifecycle actions the backend allows from a status (TenantManagementService). */
export function allowedActions(tenant: Tenant): LifecycleAction[] {
  const provisioned = tenant.provisioned_at !== null
  switch (tenant.status) {
    case "active":
      return ["suspend", "close", ...(provisioned ? (["export"] as const) : [])]
    case "suspended":
      return ["reactivate", "close", ...(provisioned ? (["export"] as const) : [])]
    case "closed":
      return [...(provisioned ? (["restore", "export"] as const) : [])]
    case "awaiting_payment":
    case "provisioning_failed":
      return ["close"]
    default:
      return []
  }
}
