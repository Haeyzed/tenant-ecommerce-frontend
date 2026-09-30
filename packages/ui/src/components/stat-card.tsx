import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Icon } from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"

type Trend = {
  /** "12.5" (percent) or null when undefined. */
  changePercent: string | null
  direction: "up" | "down" | "flat"
  sentiment: "positive" | "negative" | "neutral"
}

/** One KPI card (backend KpiValue, spec §22). Values arrive already formatted. */
function StatCard({
  label,
  value,
  trend,
  supportingLabel,
  estimated,
  className,
}: {
  label: string
  value: React.ReactNode
  trend?: Trend | null
  supportingLabel?: string | null
  estimated?: boolean
  className?: string
}) {
  return (
    <Card data-slot="stat-card" size="sm" className={cn("gap-2", className)}>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          {label}
          {estimated ? <span className="text-xs">(estimated)</span> : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <span className="truncate font-heading text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </span>
        {trend || supportingLabel ? (
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {trend && trend.changePercent !== null ? (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-medium",
                  trend.sentiment === "positive" && "text-success",
                  trend.sentiment === "negative" && "text-destructive"
                )}
              >
                {trend.direction !== "flat" ? (
                  <Icon
                    name={trend.direction === "up" ? "trendUp" : "trendDown"}
                    className="size-3.5"
                  />
                ) : null}
                {trend.changePercent}%
              </span>
            ) : null}
            {supportingLabel ? <span>{supportingLabel}</span> : null}
          </span>
        ) : null}
      </CardContent>
    </Card>
  )
}

function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <Card size="sm" className={cn("gap-3", className)}>
      <CardHeader>
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  )
}

export { StatCard, StatCardSkeleton }
export type { Trend }
