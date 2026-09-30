import type { NavEntry } from "@workspace/admin-kit/nav"

export const paymentGatewaysNav: NavEntry[] = [
  {
    id: "payment-gateways",
    label: "Payment gateways",
    icon: "billing",
    href: "/payment-gateways",
    route: "landlord.billing.payment-gateways.index",
    group: "commerce",
    order: 60,
    keywords: ["paystack", "flutterwave", "stripe", "webhook", "keys", "live", "test"],
  },
]
