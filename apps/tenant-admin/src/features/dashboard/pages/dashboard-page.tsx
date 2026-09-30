"use client"

import { useAccess } from "@workspace/access/react"
import { SectionDashboard } from "@workspace/admin-kit/dashboard"

import { useStore } from "@/shell/store-context"

import { loadSection, loadSections } from "../api/queries"
import { OnboardingCard } from "../components/onboarding-card"

/** The staff dashboard (spec §22.1, §27.3) with the owner's setup checklist. */
export function DashboardPage({ userName }: { userName: string }) {
  const { isOwner } = useAccess()
  const { display } = useStore()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"

  return (
    <SectionDashboard
      title={`${greeting}, ${userName.split(" ")[0] || userName}`}
      description="Here's how your store is doing."
      loadSections={loadSections}
      loadSection={loadSection}
      display={display}
      before={isOwner ? <OnboardingCard /> : null}
    />
  )
}
