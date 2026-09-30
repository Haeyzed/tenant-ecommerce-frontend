import type { NavEntry, NavGroup } from "@workspace/admin-kit/nav"

import { dashboardNav } from "@/features/dashboard/nav"
import { paymentGatewaysNav } from "@/features/payment-gateways/nav"
import { registrationsNav } from "@/features/registrations/nav"
import { settingsNav } from "@/features/settings/nav"

/** Sidebar groups in display order (spec §25.1). */
export const navGroups: NavGroup[] = [
  { id: "home", label: "Home" },
  { id: "tenants", label: "Tenants" },
  { id: "commerce", label: "Commerce" },
  { id: "affiliates", label: "Affiliates" },
  { id: "operations", label: "Operations" },
  { id: "content", label: "Content" },
  { id: "administration", label: "Administration" },
]

/** Each feature contributes its entries; visibility comes from permissions (spec §17.2). */
export const navEntries: NavEntry[] = [...dashboardNav, ...registrationsNav, ...paymentGatewaysNav, ...settingsNav]
