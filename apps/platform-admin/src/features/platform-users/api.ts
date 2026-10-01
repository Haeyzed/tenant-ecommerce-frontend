"use client"

import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"

import { unwrap, unwrapPage } from "@workspace/api-client"
import type { operations } from "@workspace/contract/landlord"

import { api } from "@/shell/api-client"

export type PlatformUser = operations["landlord.platform-users.index"]["responses"][200]["content"]["application/json"]["data"][number]
export type PlatformUserFilters = NonNullable<operations["landlord.platform-users.index"]["parameters"]["query"]>

const usersKey = ["platform-users"] as const

export const platformUsersQuery = (filters: PlatformUserFilters) =>
  queryOptions({
    queryKey: [...usersKey, "list", filters] as const,
    queryFn: ({ signal }) => unwrapPage(api.GET("/admin/platform-users", { params: { query: filters }, signal })),
  })

function useRefreshUsers() {
  const client = useQueryClient()
  return () => void client.invalidateQueries({ queryKey: usersKey })
}

export function useInviteUser() {
  const refresh = useRefreshUsers()
  return useMutation({
    mutationFn: async (body: { name: string; email: string; roles: string[] }) => unwrap(api.POST("/admin/platform-users", { body })),
    onSuccess: refresh,
  })
}

export function useUpdateUser(id: number) {
  const refresh = useRefreshUsers()
  return useMutation({
    mutationFn: async (body: { name?: string; email?: string; is_active?: boolean }) =>
      unwrap(api.PATCH("/admin/platform-users/{user}", { params: { path: { user: id } }, body })),
    onSuccess: refresh,
  })
}

export function useDeactivateUser(id: number) {
  const refresh = useRefreshUsers()
  return useMutation({
    mutationFn: async () => unwrap(api.POST("/admin/platform-users/{user}/deactivate", { params: { path: { user: id } } })),
    onSuccess: refresh,
  })
}

/**
 * Applies a new role set as assign and revoke calls (the API has one route
 * each). Stops at the first failure, e.g. `last_super_admin`.
 */
export function useSetRoles(id: number) {
  const refresh = useRefreshUsers()
  return useMutation({
    mutationFn: async ({ from, to }: { from: string[]; to: string[] }) => {
      for (const role of to.filter((r) => !from.includes(r))) {
        await unwrap(api.POST("/admin/platform-users/{user}/roles", { params: { path: { user: id } }, body: { role } }))
      }
      for (const role of from.filter((r) => !to.includes(r))) {
        await unwrap(api.DELETE("/admin/platform-users/{user}/roles/{role}", { params: { path: { user: id, role } } }))
      }
    },
    // Refresh even after a partial failure, so the list shows what was applied.
    onSettled: refresh,
  })
}
