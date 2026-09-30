import type { NavEntry } from "@workspace/admin-kit/nav"

export const settingsNav: NavEntry[] = [
  {
    id: "platform-settings",
    label: "Settings",
    icon: "settings",
    href: "/platform-settings",
    route: "landlord.settings.index",
    group: "administration",
    order: 90,
    keywords: ["configuration", "trials", "billing", "branding"],
  },
]
