"use client"

import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"

import { unwrap } from "@workspace/api-client"
import type { operations } from "@workspace/contract/landlord"

import { api } from "@/shell/api-client"

export type Template = operations["landlord.notifications.templates.index"]["responses"][200]["content"]["application/json"]["data"][number]
export type MatrixRow = operations["landlord.notifications.matrix.index"]["responses"][200]["content"]["application/json"]["data"][number]

/** Landlord audiences (NotificationScope::Landlord->audiences()). */
export const AUDIENCES = ["tenant", "platform_user", "affiliate", "registrant"] as const
export const AUDIENCE_LABELS: Record<string, string> = { tenant: "Store owners", platform_user: "Platform team", affiliate: "Affiliates", registrant: "People signing up" }

/** Channels in display order (NotificationChannel). */
export const CHANNELS = ["email", "database", "sms", "whatsapp", "push"] as const
export const CHANNEL_LABELS: Record<string, string> = { email: "Email", database: "In-app", sms: "SMS", whatsapp: "WhatsApp", push: "Push" }

const keys = { templates: ["notifications", "templates"] as const, matrix: ["notifications", "matrix"] as const }

export const templatesQuery = queryOptions({
  queryKey: keys.templates,
  queryFn: ({ signal }) => unwrap(api.GET("/admin/notification-templates", { signal })),
})

export const matrixQuery = queryOptions({
  queryKey: keys.matrix,
  queryFn: ({ signal }) => unwrap(api.GET("/admin/notifications/matrix", { signal })),
})

function useRefresh() {
  const client = useQueryClient()
  return () => void client.invalidateQueries({ queryKey: ["notifications"] })
}

export function useUpdateTemplate(key: string) {
  const client = useQueryClient()
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async (body: { subject?: string | null; body?: string; is_active?: boolean }) =>
      unwrap(api.PATCH("/admin/notification-templates/{key}", { params: { path: { key } }, body })),
    onSuccess: (template) => {
      client.setQueryData<Template[]>(keys.templates, (rows) => rows?.map((r) => (r.key === key ? template : r)))
      refresh()
    },
  })
}

export function useResetTemplate(key: string) {
  const client = useQueryClient()
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async () => unwrap(api.POST("/admin/notification-templates/{key}/reset", { params: { path: { key } } })),
    onSuccess: (template) => {
      client.setQueryData<Template[]>(keys.templates, (rows) => rows?.map((r) => (r.key === key ? template : r)))
      refresh()
    },
  })
}

export function useUpdateMatrix() {
  const client = useQueryClient()
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async ({ key, channels, audience }: { key: string; channels?: Record<string, boolean>; audience?: string[] }) =>
      unwrap(api.PATCH("/admin/notifications/matrix/{templateKey}", { params: { path: { templateKey: key } }, body: { channels, audience } })),
    onMutate: async ({ key, channels, audience }) => {
      // Optimistic: the switch moves at once; rolled back if the save fails.
      await client.cancelQueries({ queryKey: keys.matrix })
      const previous = client.getQueryData<MatrixRow[]>(keys.matrix)
      client.setQueryData<MatrixRow[]>(keys.matrix, (rows) =>
        rows?.map((r) => (r.key === key ? { ...r, channels: { ...r.channels, ...channels }, target_audience: audience ?? r.target_audience } : r))
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) client.setQueryData(keys.matrix, context.previous)
    },
    onSettled: refresh,
  })
}

/** "tenant.legal_reacceptance_required" → "Legal reacceptance required". */
export function templateName(key: string): string {
  const last = key.split(".").pop() ?? key
  const words = last.replace(/_/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const GROUPS: Record<string, string> = {
  tenant: "Stores",
  subscription: "Billing",
  affiliate: "Affiliates",
  platform: "Platform team",
  platform_user: "Platform team",
  platform_support: "Support",
  module_notice: "Module notices",
}

/** The area a template belongs to, from its key prefix. */
export function templateGroup(key: string): string {
  const prefix = key.split(".")[0] ?? key
  return GROUPS[prefix] ?? templateName(prefix)
}

/** Placeholders used in a text that the template doesn't offer. */
export function unknownPlaceholders(text: string, allowed: readonly string[]): string[] {
  const used = Array.from(text.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/g), (m) => m[1] ?? "")
  return [...new Set(used.filter((v) => !allowed.includes(v)))]
}

/** Live preview with the same sample values the API uses: {{name}} → [name]. */
export function previewText(text: string): string {
  return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/g, "[$1]")
}
