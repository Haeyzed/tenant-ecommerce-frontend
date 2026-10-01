import type { NavEntry } from "@workspace/admin-kit/nav"

export const couponsNav: NavEntry[] = [
  {
    id: "platform-coupons",
    label: "Coupons",
    icon: "discount",
    href: "/platform-coupons",
    route: "landlord.billing.platform-coupons.index",
    group: "commerce",
    order: 50,
    keywords: ["discount", "promo code", "offer"],
  },
]
