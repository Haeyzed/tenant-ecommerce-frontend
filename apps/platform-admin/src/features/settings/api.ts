import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"

import { ApiError, unwrap } from "@workspace/api-client"

import { api } from "@/shell/api-client"

/**
 * One platform setting as the group endpoint returns it (BG-18 adds the
 * input constraints). Encrypted values come back as null with `has_value`.
 * @source App\Modules\Settings\Services\PlatformSettingsService::group
 */
export type SettingEntry = {
  value: unknown
  type: "string" | "int" | "decimal" | "bool" | "json" | "encrypted_json" | (string & {})
  default: unknown
  public: boolean
  reason_required: boolean
  own_route: boolean
  nullable: boolean
  options: string[] | null
  min: number | null
  max: number | null
  has_value?: boolean
}

export type SettingsGroup = Record<string, SettingEntry>

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)

function normalizeGroup(data: unknown): SettingsGroup {
  if (!isRecord(data)) return {}
  const group: SettingsGroup = {}

  for (const [key, raw] of Object.entries(data)) {
    if (!isRecord(raw)) continue
    group[key] = {
      value: raw.value,
      type: typeof raw.type === "string" ? raw.type : "string",
      default: raw.default,
      public: raw.public === true,
      reason_required: raw.reason_required === true,
      own_route: raw.own_route === true,
      nullable: raw.nullable === true,
      options: Array.isArray(raw.options) ? raw.options.filter((o): o is string => typeof o === "string") : null,
      min: typeof raw.min === "number" ? raw.min : null,
      max: typeof raw.max === "number" ? raw.max : null,
      ...(typeof raw.has_value === "boolean" ? { has_value: raw.has_value } : {}),
    }
  }

  return group
}

export const settingsKeys = {
  group: (group: string) => ["platform-settings", group] as const,
  config: () => ["platform-config"] as const,
}

export const groupQuery = (group: string) =>
  queryOptions({
    queryKey: settingsKeys.group(group),
    queryFn: async ({ signal }) =>
      normalizeGroup(await unwrap(api.GET("/admin/platform-settings/{group}", { params: { path: { group } }, signal }))),
  })

/** Public platform config: the logo, favicon and share image URLs (BG-12). */
export const platformConfigQuery = () =>
  queryOptions({
    queryKey: settingsKeys.config(),
    queryFn: async ({ signal }) => (await unwrap(api.GET("/platform/config", { signal }))) as Record<string, unknown>,
  })

/** PATCH one group with only the changed keys; `reason` when a changed key needs one. */
export function useUpdateGroup(group: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ values, reason }: { values: Record<string, unknown>; reason?: string }) =>
      normalizeGroup(
        await unwrap(
          api.PATCH("/admin/platform-settings/{group}", {
            params: { path: { group } },
            body: { values, ...(reason ? { reason } : {}) },
          })
        )
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKeys.group(group), data)
      void queryClient.invalidateQueries({ queryKey: settingsKeys.config() })
    },
  })
}

/**
 * Uploads or removes an image setting (BG-12). Multipart uses fetch
 * directly: the BFF streams FormData unchanged (spec §12.5).
 */
export function useImageSetting() {
  const queryClient = useQueryClient()

  const done = () => {
    void queryClient.invalidateQueries({ queryKey: ["platform-settings"] })
    void queryClient.invalidateQueries({ queryKey: settingsKeys.config() })
  }

  const upload = useMutation({
    mutationFn: async ({ slot, file }: { slot: string; file: File }) => {
      const body = new FormData()
      body.append("setting", slot)
      body.append("image", file)
      const response = await fetch("/bff/api/admin/platform-settings/media", {
        method: "POST",
        headers: { "X-Requested-With": "bff", Accept: "application/json" },
        body,
      }).catch((cause: unknown) => {
        throw ApiError.network(cause)
      })
      const json: unknown = await response.json().catch(() => null)
      if (!response.ok) throw ApiError.fromResponse(response, json)
      return json
    },
    onSuccess: done,
  })

  const remove = useMutation({
    mutationFn: async (slot: string) =>
      unwrap(api.DELETE("/admin/platform-settings/media/{setting}", { params: { path: { setting: slot } } })),
    onSuccess: done,
  })

  return { upload, remove }
}
