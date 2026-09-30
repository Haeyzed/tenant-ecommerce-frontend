import type { NavEntry } from "@workspace/admin-kit/nav"

export const dashboardNav: NavEntry[] = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", href: "/dashboard", route: "landlord.dashboard.index", group: "home", order: 0, keywords: ["home", "overview", "metrics"] },
]
