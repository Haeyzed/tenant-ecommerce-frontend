import type { NavEntry, NavGroup } from "@workspace/admin-kit/nav"

import { catalogNav } from "@/features/catalog/nav"
import { dashboardNav } from "@/features/dashboard/nav"

/** Sidebar groups in display order (spec §27.2). */
export const navGroups: NavGroup[] = [
  { id: "overview", label: "Overview" },
  { id: "sales", label: "Sales" },
  { id: "catalog", label: "Catalogue" },
  { id: "customers", label: "Customers" },
  { id: "marketing", label: "Marketing" },
  { id: "operations", label: "Operations" },
  { id: "content", label: "Content" },
  { id: "settings", label: "Settings" },
]

/** Every feature contributes its entries; visibility is computed from the snapshot (spec §17.2). */
export const navEntries: NavEntry[] = [...dashboardNav, ...catalogNav]
