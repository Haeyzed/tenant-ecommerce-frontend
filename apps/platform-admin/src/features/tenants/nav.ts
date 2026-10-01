import type { NavEntry } from "@workspace/admin-kit/nav"

export const tenantsNav: NavEntry[] = [
  {
    id: "tenants",
    label: "Tenants",
    icon: "store",
    href: "/tenants",
    route: "landlord.tenancy.tenants.index",
    group: "tenants",
    order: 10,
    keywords: ["stores", "suspend", "close", "modules", "limits", "overrides"],
  },
]
