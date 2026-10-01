import type { Metadata } from "next"

import { NotificationsPage } from "@/features/notifications"

export const metadata: Metadata = { title: "Notifications" }

export default function Page() {
  return <NotificationsPage />
}
