import type { operations } from "@workspace/contract/landlord"
import type { StatusTone } from "@workspace/ui/components/status-badge"

// Plain module (no "use client") so server pages can read these values.
export type DocumentType = operations["landlord.legal.store"]["requestBody"]["content"]["application/json"]["document_type"]
export const DOCUMENT_TYPES: readonly DocumentType[] = ["terms_of_service", "privacy_policy", "data_processing_agreement", "acceptable_use_policy", "affiliate_agreement"]
export const LEGAL_STATUSES = ["draft", "published", "retired"] as const

export const LEGAL_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  published: { label: "Current", tone: "success" },
  retired: { label: "Retired", tone: "muted" },
}

const TYPE_LABELS: Record<string, string> = {
  terms_of_service: "Terms of service",
  privacy_policy: "Privacy policy",
  data_processing_agreement: "Data processing agreement",
  acceptable_use_policy: "Acceptable use policy",
  affiliate_agreement: "Affiliate agreement",
}

export function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type.replace(/_/g, " ")
}

/** Where an acceptance came from (LegalAcceptance::context). */
export const ACCEPTANCE_CONTEXT: Record<string, string> = {
  registration: "Sign-up",
  reacceptance: "Re-acceptance",
  affiliate_application: "Affiliate application",
}
