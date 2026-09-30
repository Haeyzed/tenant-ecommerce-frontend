import { Icon, type IconName } from "@workspace/ui/icons"

/** Full-page states that replace the whole app: unknown store, suspended, closed, provisioning (spec §11.4). */
export function FullPageState({
  icon,
  title,
  description,
  action,
}: {
  icon: IconName
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
          <Icon name={icon} className="size-6" />
        </div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        {action}
      </div>
    </main>
  )
}
