import type { NavEntry } from "@workspace/admin-kit/nav"

export const catalogNav: NavEntry[] = [
  {
    id: "products",
    label: "Products",
    icon: "products",
    href: "/products",
    route: "tenant.catalog.admin.products.index",
    group: "catalog",
    order: 10,
    keywords: ["catalogue", "items", "sku"],
  },
]
