import type { NavEntry, NavGroup } from "@workspace/admin-kit/nav"

import { affiliatesNav } from "@/features/affiliates/nav"
import { commissionsNav } from "@/features/commissions/nav"
import { couponsNav } from "@/features/coupons/nav"
import { dashboardNav } from "@/features/dashboard/nav"
import { databaseServersNav } from "@/features/database-servers/nav"
import { legalNav } from "@/features/legal/nav"
import { notificationsNav } from "@/features/notifications/nav"
import { paymentGatewaysNav } from "@/features/payment-gateways/nav"
import { transactionsNav } from "@/features/payment-transactions/nav"
import { plansNav } from "@/features/plans/nav"
import { platformUsersNav } from "@/features/platform-users/nav"
import { registrationsNav } from "@/features/registrations/nav"
import { settingsNav } from "@/features/settings/nav"
import { subscriptionsNav } from "@/features/subscriptions/nav"
import { tenantsNav } from "@/features/tenants/nav"

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
export const navEntries: NavEntry[] = [
  ...dashboardNav,
  ...tenantsNav,
  ...registrationsNav,
  ...databaseServersNav,
  ...plansNav,
  ...subscriptionsNav,
  ...transactionsNav,
  ...commissionsNav,
  ...couponsNav,
  ...paymentGatewaysNav,
  ...affiliatesNav,
  ...legalNav,
  ...platformUsersNav,
  ...notificationsNav,
  ...settingsNav,
]
