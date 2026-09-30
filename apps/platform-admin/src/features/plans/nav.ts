import type { NavEntry } from "@workspace/admin-kit/nav"

export const plansNav: NavEntry[] = [
  {
    id: "plans",
    label: "Plans",
    icon: "catalog",
    href: "/plans",
    route: "landlord.plans.index",
    group: "commerce",
    order: 10,
    keywords: ["pricing", "prices", "features", "limits", "trial"],
  },
]
