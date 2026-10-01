import type { NavEntry } from "@workspace/admin-kit/nav"

export const subscriptionsNav: NavEntry[] = [
  {
    id: "subscriptions",
    label: "Subscriptions",
    icon: "invoice",
    href: "/subscriptions",
    route: "landlord.billing.subscriptions.index",
    group: "commerce",
    order: 20,
    keywords: ["billing", "trial", "renewal", "mrr", "past due"],
  },
]
