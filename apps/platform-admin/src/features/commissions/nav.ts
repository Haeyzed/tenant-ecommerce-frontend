import type { NavEntry } from "@workspace/admin-kit/nav"

export const commissionsNav: NavEntry[] = [
  {
    id: "platform-commissions",
    label: "Commissions",
    icon: "percent",
    href: "/platform-commissions",
    route: "landlord.billing.platform-commissions.index",
    group: "commerce",
    order: 40,
    keywords: ["fees", "waive", "sales share"],
  },
]
