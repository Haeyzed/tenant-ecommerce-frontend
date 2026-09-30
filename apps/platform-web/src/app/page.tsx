import Link from "next/link"

import { Button } from "@workspace/ui/components/button"
import { Icon, type IconName } from "@workspace/ui/icons"

import { loadPlatformConfig } from "@/server/api"

const HIGHLIGHTS: { icon: IconName; title: string; body: string }[] = [
  { icon: "store", title: "Your own storefront", body: "A store on your own subdomain, ready the moment you sign up." },
  { icon: "orders", title: "Orders to delivery", body: "Orders, payments, returns and shipments in one admin." },
  { icon: "inventory", title: "Stock you can trust", body: "Warehouses, transfers and stock counts that stay in sync." },
]

/**
 * The website homepage. The CMS homepage (`GET /api/cms/home`, spec §24.1)
 * replaces this static hero once the CMS slice ships.
 */
export default async function HomePage() {
  const config = await loadPlatformConfig()

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 py-16 sm:py-24">
      <section className="flex max-w-2xl flex-col gap-6">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Run your online store with {config.name}</h1>
        <p className="text-lg text-muted-foreground text-pretty">
          Launch a storefront, take payments and manage stock, staff and customers from one place. Start with a free trial.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/pricing" />}>
            See plans
            <Icon name="arrowRight" data-icon="inline-end" />
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {HIGHLIGHTS.map((item) => (
          <div key={item.title} className="flex flex-col gap-2 rounded-xl border p-5">
            <Icon name={item.icon} className="size-5 text-primary" />
            <h2 className="font-medium">{item.title}</h2>
            <p className="text-sm text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
