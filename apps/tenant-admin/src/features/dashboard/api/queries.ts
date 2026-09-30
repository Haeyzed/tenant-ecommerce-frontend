import { queryOptions } from "@tanstack/react-query"

import { unwrap } from "@workspace/api-client"

import { api } from "@/shell/api-client"

import { normalizeSection, type RangePreset } from "./types"

export const dashboardKeys = {
  all: ["dashboard"] as const,
  sections: () => [...dashboardKeys.all, "sections"] as const,
  section: (key: string, range: RangePreset) =>
    [...dashboardKeys.all, "section", key, { range }] as const,
  onboarding: () => ["onboarding"] as const,
}

export const sectionsQuery = () =>
  queryOptions({
    queryKey: dashboardKeys.sections(),
    queryFn: async ({ signal }) => {
      const data = await unwrap(api.GET("/admin/dashboard", { signal }))
      const sections = (data as { sections?: unknown }).sections
      return Array.isArray(sections)
        ? (sections as { key: string; label: string }[])
        : []
    },
    staleTime: 5 * 60_000,
  })

/** One dashboard section; refetched every 5 minutes while visible (spec §14.3). */
export const sectionQuery = (key: string, range: RangePreset) =>
  queryOptions({
    queryKey: dashboardKeys.section(key, range),
    queryFn: async ({ signal }) =>
      normalizeSection(
        await unwrap(
          api.GET("/admin/dashboard/{section}", {
            params: { path: { section: key }, query: { range } },
            signal,
          })
        )
      ),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  })

/** @source App\Modules\Tenancy\Services\OnboardingService::checklist */
export type OnboardingStep = {
  key: string
  complete: boolean
  optional: boolean
}

export const onboardingQuery = () =>
  queryOptions({
    queryKey: dashboardKeys.onboarding(),
    queryFn: async ({ signal }) => {
      const data = (await unwrap(api.GET("/admin/onboarding", { signal }))) as {
        steps?: unknown
        completed?: unknown
        total?: unknown
        dismissed?: unknown
      }
      const steps = Array.isArray(data.steps)
        ? (data.steps as OnboardingStep[])
        : []
      return {
        steps,
        completed:
          typeof data.completed === "number"
            ? data.completed
            : steps.filter((s) => s.complete).length,
        total: typeof data.total === "number" ? data.total : steps.length,
        dismissed: data.dismissed === true,
      }
    },
    staleTime: 60_000,
  })
