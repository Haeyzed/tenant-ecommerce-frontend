import { Icon, type IconName } from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"

import type { StaffSession } from "./me"

type Tone = "warning" | "info" | "danger"

const TONES: Record<Tone, string> = {
  warning: "bg-warning/12 text-foreground [&_svg]:text-warning",
  info: "bg-info/10 text-foreground [&_svg]:text-info",
  danger: "bg-destructive/10 text-foreground [&_svg]:text-destructive",
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: Tone
  icon: IconName
  children: React.ReactNode
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 border-b px-4 py-2 text-sm sm:items-center sm:px-6 lg:px-8",
        TONES[tone]
      )}
    >
      <Icon name={icon} className="mt-0.5 size-4 shrink-0 sm:mt-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/**
 * The banner stack in priority order (spec §17.1): subscription
 * restriction, test payment mode, legal re-acceptance. Server-rendered from
 * the session snapshot.
 */
export function ShellBanners({ session }: { session: StaffSession }) {
  const banners: React.ReactNode[] = []

  if (session.subscriptionStatus === "past_due") {
    banners.push(
      <Banner key="past-due" tone="danger" icon="billing">
        Your subscription payment is overdue. The admin may become read-only
        until payment is made.
      </Banner>
    )
  }

  if (session.paymentMode === "test") {
    banners.push(
      <Banner key="test-mode" tone="warning" icon="alert">
        <span className="font-medium">Test mode.</span> Payments use test
        credentials and no real money moves.
      </Banner>
    )
  }

  if (session.isOwner && session.pendingLegalDocuments.length > 0) {
    banners.push(
      <Banner key="legal" tone="info" icon="file">
        Updated terms need your review:{" "}
        {session.pendingLegalDocuments.map((d) => d.title).join(", ")}.
      </Banner>
    )
  }

  return banners.length > 0 ? <>{banners}</> : null
}
