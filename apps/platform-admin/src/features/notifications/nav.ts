import type { NavEntry } from "@workspace/admin-kit/nav"

export const notificationsNav: NavEntry[] = [
  {
    id: "notifications",
    label: "Notifications",
    icon: "notifications",
    href: "/notifications",
    route: "landlord.notifications.templates.index",
    group: "administration",
    order: 20,
    keywords: ["email", "templates", "messages", "sms", "channels"],
  },
]
