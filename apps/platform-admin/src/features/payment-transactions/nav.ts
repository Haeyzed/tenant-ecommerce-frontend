import type { NavEntry } from "@workspace/admin-kit/nav"

export const transactionsNav: NavEntry[] = [
  {
    id: "payment-transactions",
    label: "Transactions",
    icon: "money",
    href: "/payment-transactions",
    route: "landlord.billing.payment-transactions.index",
    group: "commerce",
    order: 30,
    keywords: ["payments", "charges", "refunds", "chargebacks"],
  },
]
