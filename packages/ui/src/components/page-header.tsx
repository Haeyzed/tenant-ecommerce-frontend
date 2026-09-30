import { cn } from "@workspace/ui/lib/utils"

/**
 * The top of every admin page: title, description and actions. Actions
 * wrap under the title on small screens.
 */
function PageHeader({
  title,
  description,
  actions,
  meta,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  /** Primary and secondary actions, rightmost last. */
  actions?: React.ReactNode
  /** Status badges or other context shown beside the title. */
  meta?: React.ReactNode
  className?: string
}) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate font-heading text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          {meta}
        </div>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  )
}

export { PageHeader }
