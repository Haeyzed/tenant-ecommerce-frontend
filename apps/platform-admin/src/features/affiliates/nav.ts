import type { NavEntry } from "@workspace/admin-kit/nav"

export const affiliatesNav: NavEntry[] = [
  {
    id: "affiliates",
    label: "Affiliates",
    icon: "customers",
    href: "/affiliates",
    route: "landlord.affiliates.admin.index",
    group: "affiliates",
    order: 10,
    keywords: ["partners", "referrers", "applications"],
  },
  {
    id: "affiliate-referrals",
    label: "Referrals",
    icon: "integrations",
    href: "/affiliate-referrals",
    route: "landlord.affiliates.admin.referrals.index",
    group: "affiliates",
    order: 20,
    keywords: ["referred stores", "fraud", "flags"],
  },
  {
    id: "affiliate-commissions",
    label: "Commissions",
    icon: "percent",
    href: "/affiliate-commissions",
    route: "landlord.affiliates.admin.commissions.index",
    group: "affiliates",
    order: 30,
    keywords: ["affiliate earnings", "approve commissions"],
  },
  {
    id: "affiliate-payouts",
    label: "Payouts",
    icon: "wallet",
    href: "/affiliate-payouts",
    route: "landlord.affiliates.admin.payouts.index",
    group: "affiliates",
    order: 40,
    keywords: ["pay affiliates", "transfers"],
  },
]
