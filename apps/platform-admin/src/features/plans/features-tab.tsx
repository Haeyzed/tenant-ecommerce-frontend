"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { useCan } from "@workspace/access/react"
import { ErrorState } from "@workspace/admin-kit/states"
import { Field, FieldContent, FieldDescription, FieldTitle } from "@workspace/ui/components/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "@workspace/ui/components/toast"
import { Icon } from "@workspace/ui/icons"

import { FEATURE_KIND_LABELS, featureCatalogQuery, useToggleFeature, type FeatureDefinition, type Plan } from "./api"

const KIND_ORDER = ["module", "capability", "integration"]

/**
 * What a plan includes (spec §11.3): every feature the platform offers,
 * switched on or off for this plan. Changes apply to subscribers at their
 * next plan check; features they already use stay read-only (spec §11.5).
 */
export function FeaturesTab({ plan }: { plan: Plan }) {
  const catalog = useQuery(featureCatalogQuery)
  const toggle = useToggleFeature(plan.id)
  const [search, setSearch] = useState("")
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const canAttach = useCan("landlord.plans.features.store")
  const canDetach = useCan("landlord.plans.features.destroy")

  const included = useMemo(() => new Set(plan.features), [plan.features])
  const names = useMemo(() => new Map((catalog.data ?? []).map((f) => [f.key, f.name])), [catalog.data])

  const groups = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const rows = (catalog.data ?? []).filter((f) => !needle || f.name.toLowerCase().includes(needle) || f.key.includes(needle))
    const byKind = new Map<string, FeatureDefinition[]>()
    for (const row of rows) byKind.set(row.kind, [...(byKind.get(row.kind) ?? []), row])
    const rank = (kind: string) => (KIND_ORDER.includes(kind) ? KIND_ORDER.indexOf(kind) : KIND_ORDER.length)
    return [...byKind.entries()].sort(([a], [b]) => rank(a) - rank(b))
  }, [catalog.data, search])

  async function change(feature: FeatureDefinition, on: boolean) {
    setPendingKey(feature.key)
    try {
      await toggle.mutateAsync({ key: feature.key, on })
      toast.add({ title: `${feature.name} ${on ? "added to" : "removed from"} ${plan.name}`, type: "success" })
    } catch (error) {
      toast.add({ title: `Couldn't change ${feature.name}`, description: error instanceof Error ? error.message : undefined, type: "error" })
    } finally {
      setPendingKey(null)
    }
  }

  if (catalog.isPending) return <Skeleton className="h-96 w-full" />
  if (catalog.isError) return <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {included.size} of {catalog.data.length} features included. Removing one makes it read-only for stores on this plan; their data is kept.
        </p>
        <InputGroup className="w-full sm:w-64">
          <InputGroupAddon>
            <Icon name="search" />
          </InputGroupAddon>
          <InputGroupInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search features" aria-label="Search features" />
        </InputGroup>
      </div>

      {groups.map(([kind, features]) => (
        <section key={kind} className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            {FEATURE_KIND_LABELS[kind] ?? kind}{" "}
            <span className="font-normal text-muted-foreground">
              ({features.filter((f) => included.has(f.key)).length}/{features.length})
            </span>
          </h3>
          <div className="grid gap-2 md:grid-cols-2">
            {features.map((feature) => {
              const on = included.has(feature.key)
              const missing = feature.requires.filter((r) => !included.has(r))
              const allowed = on ? canDetach : canAttach
              return (
                <Field key={feature.key} orientation="horizontal" className="rounded-lg border p-3">
                  <FieldContent>
                    <FieldTitle>{feature.name}</FieldTitle>
                    <FieldDescription>
                      <span className="font-mono text-xs">{feature.key}</span>
                      {on && missing.length > 0 ? (
                        <span className="mt-1 block text-warning">Needs {missing.map((r) => names.get(r) ?? r).join(", ")}, which this plan doesn&apos;t include.</span>
                      ) : null}
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    checked={on}
                    disabled={!allowed || pendingKey === feature.key}
                    onCheckedChange={(next) => void change(feature, next)}
                    aria-label={`${on ? "Remove" : "Include"} ${feature.name}`}
                  />
                </Field>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
