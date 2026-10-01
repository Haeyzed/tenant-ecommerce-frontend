import Link from "next/link"
import type { ReactNode } from "react"

import { ButtonLink } from "@workspace/ui/components/button-link"
import { Icon } from "@workspace/ui/icons"

import { ReferralCapture } from "@/features/referral/referral-capture"
import type { PlatformConfig } from "@/features/signup/model"

/** The site header and footer (spec §24.1). CMS menus replace the fixed links once the CMS pages ship. */
export function SiteShell({ config, children }: { config: PlatformConfig; children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <ReferralCapture />
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold">
            {config.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- platform logo is an uploaded, arbitrary-host image
              <img src={config.logoUrl} alt="" className="size-7 rounded-md object-contain" />
            ) : (
              <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Icon name="store" className="size-4" />
              </span>
            )}
            <span className="truncate">{config.name}</span>
          </Link>
          <nav className="flex items-center gap-1">
            <ButtonLink variant="ghost" size="sm" render={<Link href="/pricing" />}>
              Pricing
            </ButtonLink>
            {config.registrationEnabled ? (
              <ButtonLink size="sm" render={<Link href="/pricing" />}>
                Start free
              </ButtonLink>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {config.name}
          </p>
          {config.supportEmail ? (
            <a href={`mailto:${config.supportEmail}`} className="hover:text-foreground">
              {config.supportEmail}
            </a>
          ) : null}
        </div>
      </footer>
    </div>
  )
}
