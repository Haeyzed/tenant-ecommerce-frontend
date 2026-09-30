import { cn } from "@workspace/ui/lib/utils"

/** The six tones every backend status maps to (spec §23.2). */
export type StatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "muted"

const TONES: Record<StatusTone, string> = {
  neutral: "bg-secondary text-secondary-foreground",
  info: "bg-info/12 text-info",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/12 text-destructive",
  muted: "bg-muted text-muted-foreground",
}

const DOTS: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  muted: "bg-muted-foreground/60",
}

function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      data-slot="status-badge"
      data-tone={tone}
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", DOTS[tone])}
      />
      {children}
    </span>
  )
}

export { StatusBadge }
