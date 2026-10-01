import type { NavEntry } from "@workspace/admin-kit/nav"

export const legalNav: NavEntry[] = [
  {
    id: "legal-documents",
    label: "Legal documents",
    icon: "file",
    href: "/legal-documents",
    route: "landlord.legal.index",
    group: "content",
    order: 10,
    keywords: ["terms", "privacy", "policy", "agreement", "dpa"],
  },
]
