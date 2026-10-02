import type { StatusTone } from "@workspace/ui/components/status-badge"

type Label = { label: string; tone: StatusTone }

/** Affiliate statuses (Affiliate::STATUSES). */
export const AFFILIATE_STATUSES = ["pending", "approved", "rejected", "suspended", "closed"] as const
export const AFFILIATE_STATUS: Record<string, Label> = {
  pending: { label: "Applied", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "muted" },
  suspended: { label: "Suspended", tone: "danger" },
  closed: { label: "Closed", tone: "muted" },
}

/** Referral statuses (AffiliateReferral::STATUSES). */
export const REFERRAL_STATUSES = ["registered", "converted", "ineligible", "rejected"] as const
export const REFERRAL_STATUS: Record<string, Label> = {
  registered: { label: "Signed up", tone: "info" },
  converted: { label: "Converted", tone: "success" },
  ineligible: { label: "Ineligible", tone: "muted" },
  rejected: { label: "Rejected", tone: "danger" },
}

/** Affiliate commission statuses (AffiliateCommission::STATUSES). */
export const COMMISSION_STATUSES = ["pending", "approved", "rejected", "reversed", "paid"] as const
export const AFFILIATE_COMMISSION_STATUS: Record<string, Label> = {
  pending: { label: "Pending", tone: "warning" },
  approved: { label: "Approved", tone: "info" },
  rejected: { label: "Rejected", tone: "muted" },
  reversed: { label: "Reversed", tone: "muted" },
  paid: { label: "Paid", tone: "success" },
}

/** Payout statuses (AffiliatePayout::STATUSES). */
export const PAYOUT_STATUSES = ["pending", "paid", "failed", "cancelled"] as const
export const PAYOUT_STATUS: Record<string, Label> = {
  pending: { label: "To pay", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "muted" },
}

/** How a referral was attributed (AffiliateAttributionService::SOURCE_*). */
export const REFERRAL_SOURCE: Record<string, string> = {
  link: "Referral link",
  registration_code: "Code at sign-up",
  coupon: "Affiliate coupon",
}

/** Why a referral earns nothing. */
export const INELIGIBLE_REASON: Record<string, string> = {
  self_referral: "Referred their own store",
  conversion_window_expired: "Didn't pay within the conversion window",
  affiliate_not_active: "Affiliate wasn't active at conversion",
  first_payment_refunded: "First payment was refunded",
}

/** Fraud review flags (AffiliateFraudService). */
export const RISK_FLAG: Record<string, string> = {
  shared_payment_method: "Shared payment method",
  rapid_refund: "Rapid refunds",
}

export const PAYOUT_METHOD: Record<string, string> = {
  bank_transfer: "Bank transfer",
  paypal: "PayPal",
  other: "Other",
}

/** Labels for the payout details keys an affiliate enters. */
export const PAYOUT_DETAIL_LABEL: Record<string, string> = {
  account_name: "Account name",
  account_number: "Account number",
  bank_name: "Bank",
  bank_code: "Bank code",
  iban: "IBAN",
  swift: "SWIFT / BIC",
  paypal_email: "PayPal email",
  instructions: "Instructions",
}

export function detailLabel(key: string): string {
  return PAYOUT_DETAIL_LABEL[key] ?? key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
}

export function textOf(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return "—"
  return map[value] ?? value.replace(/_/g, " ")
}
