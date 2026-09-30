import type { ReactNode } from "react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Icon } from "@workspace/ui/icons"

import type { StoreBranding } from "@/server/api"

/**
 * The split sign-in layout: a brand panel on large screens and a centred
 * card everywhere. Server component; the form inside is the only island.
 */
export function AuthLayout({
  branding,
  title,
  description,
  children,
}: {
  branding: StoreBranding | null
  title: string
  description: string
  children: ReactNode
}) {
  const name = branding?.name ?? "Store admin"

  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -end-24 -top-24 size-96 rounded-full bg-primary-foreground/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -start-16 -bottom-32 size-[28rem] rounded-full bg-primary-foreground/5 blur-3xl"
        />
        <div className="relative flex items-center gap-3">
          <Avatar className="size-10 rounded-xl">
            {branding?.logoUrl ? (
              <AvatarImage src={branding.logoUrl} alt="" />
            ) : null}
            <AvatarFallback className="rounded-xl bg-primary-foreground/15 text-primary-foreground">
              <Icon name="store" />
            </AvatarFallback>
          </Avatar>
          <span className="text-lg font-semibold">{name}</span>
        </div>
        <div className="relative flex max-w-md flex-col gap-4">
          <p className="font-heading text-3xl leading-tight font-semibold tracking-tight">
            Run your whole store from one place.
          </p>
          <p className="text-primary-foreground/75">
            Orders, catalogue, customers, inventory and every module your plan
            includes, with your team&apos;s access kept exactly where you set
            it.
          </p>
        </div>
        <p className="relative text-sm text-primary-foreground/60">
          Store administration
        </p>
      </aside>
      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <div className="flex flex-col gap-2">
            <div className="mb-4 flex items-center gap-2 lg:hidden">
              <Avatar className="size-9 rounded-lg">
                {branding?.logoUrl ? (
                  <AvatarImage src={branding.logoUrl} alt="" />
                ) : null}
                <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                  <Icon name="store" />
                </AvatarFallback>
              </Avatar>
              <span className="font-semibold">{name}</span>
            </div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
