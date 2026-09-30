import type { Metadata } from "next"

import { RegistrationsPage } from "@/features/registrations"

export const metadata: Metadata = { title: "Registrations" }

export default function Page() {
  return <RegistrationsPage />
}
