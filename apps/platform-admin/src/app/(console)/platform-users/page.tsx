import type { Metadata } from "next"

import { PlatformUsersPage } from "@/features/platform-users"

export const metadata: Metadata = { title: "Platform users" }

export default function Page() {
  return <PlatformUsersPage />
}
