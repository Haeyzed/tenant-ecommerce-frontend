"use client"

import { useQuery } from "@tanstack/react-query"

import { unwrap } from "@workspace/api-client"
import type { operations } from "@workspace/contract/landlord"

import { api } from "@/shell/api-client"

export type RegistrationStatus = operations["landlord.register.status"]["responses"][200]["content"]["application/json"]["data"]

type Interval = number | false

/** GET /api/register/{registration}/status as a query (spec §24.3 steps 4 and 5). */
export function useRegistrationStatus(
  registration: string,
  options: { refetchInterval?: Interval | ((query: { state: { data: RegistrationStatus | undefined } }) => Interval) } = {}
) {
  return useQuery({
    queryKey: ["registration", registration, "status"],
    queryFn: async ({ signal }) =>
      unwrap(api.GET("/register/{registration}/status", { params: { path: { registration } }, signal })),
    refetchInterval: options.refetchInterval ?? false,
    staleTime: 0,
  })
}
