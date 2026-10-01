"use client"

import { formatDate, formatDateTime, formatNumber } from "@workspace/format"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import { Icon } from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"

import { DetailCard } from "@/features/billing/details"
import { useLookup } from "@/features/lookups"
import { useConsole } from "@/shell/console-context"

import type { TenantDetails } from "./api"

const DOMAIN_STATUS_TONE = { active: "success", verified: "success", pending_verification: "warning", misconfigured: "danger", failed: "danger" } as const

function usageText(key: string, value: number | null): string {
  if (value === null) return "Unlimited"
  return key === "max_storage_mb" ? (value >= 1024 ? `${formatNumber(value / 1024, { maximumFractionDigits: 1 })} GB` : `${value} MB`) : formatNumber(value)
}

/** Profile, domains and usage against limits (spec §25.1 tenant overview). */
export function OverviewTab({ details }: { details: TenantDetails }) {
  const { display } = useConsole()
  const countries = useLookup("countries")
  const t = details.tenant
  const country = countries.data?.find((c) => c.value === String(t.country_id))?.label

  return (
    <div className="flex flex-col gap-4">
      {t.status === "closed" && t.purge_after ? (
        <Alert variant="destructive">
          <Icon name="alert" />
          <AlertTitle>Closed, data kept until {formatDate(t.purge_after, display)}</AlertTitle>
          <AlertDescription>
            {t.status_reason ? `Reason: ${t.status_reason}. ` : ""}After that date the store and its data are purged for good. Restore it before then to keep it.
          </AlertDescription>
        </Alert>
      ) : t.status === "suspended" ? (
        <Alert variant="destructive">
          <Icon name="alert" />
          <AlertTitle>Suspended{t.suspended_at ? ` since ${formatDate(t.suspended_at, display)}` : ""}</AlertTitle>
          <AlertDescription>{t.status_reason ?? "No reason recorded."}</AlertDescription>
        </Alert>
      ) : t.status === "provisioning_failed" ? (
        <Alert variant="destructive">
          <Icon name="error" />
          <AlertTitle>Setting up the store failed</AlertTitle>
          <AlertDescription>
            Retry from the server with <code className="font-mono">php artisan tenants:retry-provisioning {t.id}</code>.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <DetailCard
          title="Store"
          details={[
            { term: "Owner", value: t.owner_name },
            { term: "Email", value: <a href={`mailto:${t.email}`} className="underline underline-offset-4">{t.email}</a> },
            { term: "Slug", value: <span className="font-mono text-xs">{t.slug}</span> },
            { term: "Country", value: country },
            { term: "Currency", value: t.default_currency },
            { term: "Time zone", value: t.timezone },
            { term: "Signed up", value: formatDateTime(t.created_at, display) },
            { term: "Set up", value: t.provisioned_at ? formatDateTime(t.provisioned_at, display) : "Not yet" },
            { term: "Trial used", value: t.trial_consumed_at ? formatDate(t.trial_consumed_at, display) : "No" },
            { term: "Store id", value: <span className="font-mono text-xs">{t.id}</span>, wide: true },
          ]}
        />

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Domains</CardTitle>
            <CardDescription>The store's addresses. Custom domains are managed by the store.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {(t.domains ?? []).length === 0 ? (
              <p className="px-4 text-sm text-muted-foreground">No domains.</p>
            ) : (
              <ul className="divide-y">
                {(t.domains ?? []).map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <a href={`https://${d.domain}`} target="_blank" rel="noreferrer" className="truncate font-medium underline-offset-4 hover:underline">
                        {d.domain}
                      </a>
                      {d.is_primary ? <Badge variant="secondary">Primary</Badge> : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-muted-foreground capitalize">{d.type}</span>
                      <StatusBadge tone={DOMAIN_STATUS_TONE[d.status as keyof typeof DOMAIN_STATUS_TONE] ?? "neutral"}>{d.status.replace(/_/g, " ")}</StatusBadge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
          <CardDescription>Against the plan's limits, including any store-specific overrides.</CardDescription>
        </CardHeader>
        <CardContent>
          {details.usage === null ? (
            <p className="text-sm text-muted-foreground">Usage is available once the store is set up.</p>
          ) : (
            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(details.usage).map(([key, u]) => {
                const ratio = u.used !== null && u.limit !== null && u.limit > 0 ? Math.min(1, u.used / u.limit) : null
                const over = u.used !== null && u.limit !== null && u.used > u.limit
                return (
                  <div key={key} className="flex flex-col gap-1.5">
                    <dt className="flex items-baseline justify-between gap-2 text-sm">
                      <span>{u.label}</span>
                      <span className={cn("tabular-nums text-muted-foreground", over && "font-medium text-destructive")}>
                        {u.used === null ? "—" : usageText(key, u.used)} / {usageText(key, u.limit)}
                      </span>
                    </dt>
                    <dd>
                      <Progress
                        value={ratio === null ? 0 : ratio * 100}
                        aria-label={`${u.label}: ${u.used ?? "unknown"} of ${u.limit ?? "unlimited"}`}
                        className={cn(ratio !== null && ratio >= 0.9 && "[&_[data-slot=progress-indicator]]:bg-warning", over && "[&_[data-slot=progress-indicator]]:bg-destructive")}
                      />
                    </dd>
                  </div>
                )
              })}
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
