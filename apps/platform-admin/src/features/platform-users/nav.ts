import type { NavEntry } from "@workspace/admin-kit/nav"

export const platformUsersNav: NavEntry[] = [
  {
    id: "platform-users",
    label: "Platform users",
    icon: "user",
    href: "/platform-users",
    route: "landlord.platform-users.index",
    group: "administration",
    order: 10,
    keywords: ["team", "staff", "roles", "invite", "admins"],
  },
]
