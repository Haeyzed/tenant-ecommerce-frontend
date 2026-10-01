import { StatusBadge, type StatusTone } from "@workspace/ui/components/status-badge"

type Label = { label: string; tone: StatusTone }

/** Subscription statuses (App\Modules\Billing\Enums\SubscriptionStatus). */
export const SUBSCRIPTION_STATUS: Record<string, Label> = {
  incomplete: { label: "Incomplete", tone: "warning" },
  trialing: { label: "Trialing", tone: "info" },
  active: { label: "Active", tone: "success" },
  past_due: { label: "Past due", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "muted" },
}

/** Payment transaction statuses and types (PaymentTransaction). */
export const TRANSACTION_STATUS: Record<string, Label> = {
  pending: { label: "Pending", tone: "warning" },
  successful: { label: "Successful", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
}

export const TRANSACTION_TYPE: Record<string, string> = {
  charge: "Charge",
  authorization: "Card check",
  refund: "Refund",
  chargeback: "Chargeback",
}

/** Platform commission statuses (PlatformCommission). */
export const COMMISSION_STATUS: Record<string, Label> = {
  pending: { label: "Pending", tone: "warning" },
  billed: { label: "Billed", tone: "info" },
  collected: { label: "Collected", tone: "success" },
  waived: { label: "Waived", tone: "muted" },
}

/** Coupon redemption statuses (PlatformCouponRedemption). */
export const REDEMPTION_STATUS: Record<string, Label> = {
  reserved: { label: "Reserved", tone: "neutral" },
  active: { label: "Active", tone: "success" },
  completed: { label: "Completed", tone: "muted" },
  released: { label: "Released", tone: "muted" },
}

export const PROVIDER_LABELS: Record<string, string> = { paystack: "Paystack", flutterwave: "Flutterwave", stripe: "Stripe" }

export const INTERVAL_LABELS: Record<string, string> = { monthly: "Monthly", yearly: "Yearly" }

export function StatusLabel({ map, value }: { map: Record<string, Label>; value: string }) {
  const s = map[value] ?? { label: value.replace(/_/g, " "), tone: "neutral" as const }
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
}

/** Test records are always marked, so they are never mistaken for real money. */
export function ModeBadge({ mode }: { mode: string }) {
  return mode === "test" ? <StatusBadge tone="warning">Test</StatusBadge> : null
}

export function labelOf(map: Record<string, Label>, value: string): string {
  return map[value]?.label ?? value.replace(/_/g, " ")
}
