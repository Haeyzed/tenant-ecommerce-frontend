import type { NavEntry } from "@workspace/admin-kit/nav"

export const registrationsNav: NavEntry[] = [
  {
    id: "registrations",
    label: "Registrations",
    icon: "userAdd",
    href: "/tenant-registrations",
    route: "landlord.tenancy.registrations.index",
    group: "tenants",
    order: 20,
    keywords: ["signup", "sign-ups", "onboarding"],
  },
]
