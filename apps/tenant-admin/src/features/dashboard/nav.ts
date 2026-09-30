import type { NavEntry } from "@workspace/admin-kit/nav"

export const dashboardNav: NavEntry[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "dashboard",
    href: "/",
    route: "tenant.onboarding.show",
    group: "overview",
    order: 0,
    keywords: ["home", "overview"],
  },
]
