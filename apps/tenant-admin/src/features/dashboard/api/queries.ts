import { queryOptions } from "@tanstack/react-query"

import {
  normalizeSection,
  type RangePreset,
  type SectionSummary,
} from "@workspace/admin-kit/dashboard"
import { unwrap } from "@workspace/api-client"

import { api } from "@/shell/api-client"

/** GET /api/admin/dashboard: the sections this staff member may see. */
export async function loadSections(signal: AbortSignal): Promise<SectionSummary[]> {
  const data = await unwrap(api.GET("/admin/dashboard", { signal }))
  const sections = (data as { sections?: unknown }).sections
  return Array.isArray(sections) ? (sections as SectionSummary[]) : []
}

/** GET /api/admin/dashboard/{section}: one section for a date range. */
export async function loadSection(key: string, range: RangePreset, signal: AbortSignal) {
  return normalizeSection(
    await unwrap(
      api.GET("/admin/dashboard/{section}", {
        params: { path: { section: key }, query: { range } },
        signal,
      })
    )
  )
}

/** @source App\Modules\Tenancy\Services\OnboardingService::checklist */
export type OnboardingStep = {
  key: string
  complete: boolean
  optional: boolean
}

export const onboardingQuery = () =>
  queryOptions({
    queryKey: ["onboarding"] as const,
    queryFn: async ({ signal }) => {
      const data = (await unwrap(api.GET("/admin/onboarding", { signal }))) as {
        steps?: unknown
        completed?: unknown
        total?: unknown
        dismissed?: unknown
      }
      const steps = Array.isArray(data.steps) ? (data.steps as OnboardingStep[]) : []
      return {
        steps,
        completed: typeof data.completed === "number" ? data.completed : steps.filter((s) => s.complete).length,
        total: typeof data.total === "number" ? data.total : steps.length,
        dismissed: data.dismissed === true,
      }
    },
    staleTime: 60_000,
  })
