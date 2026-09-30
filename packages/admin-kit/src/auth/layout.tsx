import type { ReactNode } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Icon, type IconName } from "@workspace/ui/icons"

export type AuthBrand = {
  name: string
  logoUrl?: string | null
  /** Small caption under the brand panel, e.g. "Store administration". */
  caption: string
  headline: string
  blurb: string
  icon?: IconName
}

/**
 * The split sign-in layout shared by every admin app: a brand panel on
 * large screens and a centred column everywhere. Server component.
 */
export function AuthLayout({ brand, title, description, children }: { brand: AuthBrand; title: string; description: ReactNode; children: ReactNode }) {
  const mark = (
    <Avatar className="size-10 rounded-xl">
      {brand.logoUrl ? <AvatarImage src={brand.logoUrl} alt="" /> : null}
      <AvatarFallback className="rounded-xl bg-primary-foreground/15 text-primary-foreground">
        <Icon name={brand.icon ?? "store"} />
      </AvatarFallback>
    </Avatar>
  )

  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="pointer-events-none absolute -end-24 -top-24 size-96 rounded-full bg-primary-foreground/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -start-16 size-[28rem] rounded-full bg-primary-foreground/5 blur-3xl" />
        <div className="relative flex items-center gap-3">
          {mark}
          <span className="text-lg font-semibold">{brand.name}</span>
        </div>
        <div className="relative flex max-w-md flex-col gap-4">
          <p className="font-heading text-3xl leading-tight font-semibold tracking-tight">{brand.headline}</p>
          <p className="text-primary-foreground/75">{brand.blurb}</p>
        </div>
        <p className="relative text-sm text-primary-foreground/60">{brand.caption}</p>
      </aside>
      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <div className="flex flex-col gap-2">
            <div className="mb-4 flex items-center gap-2 lg:hidden">
              <Avatar className="size-9 rounded-lg">
                {brand.logoUrl ? <AvatarImage src={brand.logoUrl} alt="" /> : null}
                <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                  <Icon name={brand.icon ?? "store"} />
                </AvatarFallback>
              </Avatar>
              <span className="font-semibold">{brand.name}</span>
            </div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}

/** A page that replaces the whole app: unknown host, suspended, closed, maintenance (spec §11.4). */
export function FullPageState({ icon, title, description, action }: { icon: IconName; title: string; description: string; action?: ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
          <Icon name={icon} className="size-6" />
        </div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        {action}
      </div>
    </main>
  )
}
