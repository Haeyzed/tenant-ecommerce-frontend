import type { NavEntry } from "@workspace/admin-kit/nav"

export const databaseServersNav: NavEntry[] = [
  {
    id: "database-servers",
    label: "Database servers",
    icon: "device",
    href: "/database-servers",
    route: "landlord.tenancy.database-servers.index",
    group: "tenants",
    order: 30,
    keywords: ["mysql", "capacity", "placement"],
  },
]
