/**
 * Wording for the platform settings screen. The API supplies each key's
 * type, value, allowed options and limits (BG-18); this file only supplies
 * human labels and explanations. Unknown keys fall back to a readable
 * version of the key, so a new backend key still renders.
 */
export const GROUPS: Record<string, { label: string; description: string }> = {
  general: { label: "General", description: "Platform name, branding, support contacts, legal entity and search appearance." },
  localization: { label: "Localization", description: "Defaults for new stores and for the platform console." },
  tenant_onboarding: { label: "Sign-ups", description: "Whether new stores can register and be set up, and how long verification lasts." },
  trials: { label: "Trials", description: "Free trial length for new subscriptions." },
  billing: { label: "Billing", description: "Plan changes, overdue payments and reporting currencies." },
  payments: { label: "Payments and commission", description: "Platform commission on store sales." },
  commerce: { label: "Commerce defaults", description: "Rules applied to every store unless a store overrides them." },
  affiliates: { label: "Affiliate programme", description: "Commission, attribution and payouts for affiliates." },
  custom_domains: { label: "Custom domains", description: "How stores connect their own domains." },
  email: { label: "Email", description: "Platform-sent email." },
  system: { label: "System and maintenance", description: "Maintenance mode and data retention." },
}

export const FIELDS: Record<string, { label: string; description?: string }> = {
  platform_name: { label: "Platform name", description: "Shown in emails, the website and this console." },
  platform_logo_media_id: { label: "Logo" },
  platform_favicon_media_id: { label: "Favicon", description: "A square image, at least 64 × 64 pixels." },
  support_email: { label: "Support email" },
  support_phone: { label: "Support phone" },
  legal_entity_name: { label: "Legal entity name", description: "Printed on invoices and legal documents." },
  legal_entity_address: { label: "Legal entity address" },
  social_links: { label: "Social links" },
  seo_title_template: { label: "Page title template", description: "{page} is the page title and {platform_name} the platform name." },
  seo_default_description: { label: "Default description", description: "Used by search engines when a page has none." },
  seo_share_image_media_id: { label: "Share image", description: "Shown when a link is shared. 1200 × 630 pixels works best." },
  analytics_measurement_id: { label: "Google Analytics ID", description: "For example G-XXXXXXXXXX." },

  default_timezone: { label: "Timezone" },
  default_locale: { label: "Locale", description: "Language and region code, for example en or en-GB." },
  default_date_format: { label: "Date format" },
  default_time_format: { label: "Time format" },
  default_currency: { label: "Currency" },

  tenant_registration_enabled: { label: "Accept new sign-ups", description: "When off, the website's sign-up form shows that sign-ups are paused." },
  tenant_provisioning_enabled: { label: "Set up new stores", description: "When off, verified sign-ups wait until you switch this back on." },
  registration_verification_hours: { label: "Verification code lifetime (hours)" },
  unpaid_registration_expiry_days: { label: "Unpaid sign-up expiry (days)", description: "Stores that never pay are closed after this many days." },

  trials_enabled: { label: "Offer free trials" },
  default_trial_days: { label: "Trial length (days)" },

  proration_mode: { label: "Plan change timing", description: "When an upgrade or downgrade takes effect." },
  past_due_grace_days: { label: "Grace period (days)", description: "Days after a failed payment before restrictions apply." },
  past_due_restriction: { label: "When payment is overdue", description: "What happens to the store admin after the grace period." },
  close_tenants_on_cancellation: { label: "Close stores when a subscription ends" },
  reporting_exchange_rates: { label: "Reporting exchange rates", description: "Used only to combine currencies in platform reports. Rate per 1 unit of the default currency." },

  billing_payment_mode: { label: "Billing payment mode", description: "Changed from Payment gateways, where credentials are checked first." },
  commission_enabled: { label: "Charge commission on store sales" },
  default_commission_rate: { label: "Default commission rate (%)" },

  guest_checkout_allowed_platform_wide: { label: "Allow guest checkout", description: "Stores can still turn guest checkout off for themselves." },
  max_pos_registers_per_warehouse: { label: "POS registers per location", description: "Leave empty for no platform-wide cap." },
  default_return_window_days: { label: "Default return window (days)" },

  affiliate_program_enabled: { label: "Run the affiliate programme" },
  affiliate_default_commission_rate: { label: "Default commission rate (%)" },
  affiliate_cookie_days: { label: "Referral cookie lifetime (days)" },
  affiliate_conversion_window_days: { label: "Conversion window (days)", description: "Leave empty to use the cookie lifetime." },
  affiliate_commission_hold_days: { label: "Hold before approval (days)", description: "Protects against refunds and chargebacks." },
  affiliate_commission_approval: { label: "Commission approval" },
  affiliate_minimum_payout: { label: "Minimum payout", description: "Per currency. Balances below this roll over." },
  affiliate_payout_schedule: { label: "Payout schedule" },
  affiliate_payout_day: { label: "Payout day of the month", description: "1 to 28, so it exists in every month." },
  affiliate_coupon_attribution_enabled: { label: "Attribute sign-ups by coupon code" },

  custom_domains_enabled: { label: "Allow custom domains" },
  custom_domain_cname_target: { label: "CNAME target", description: "The host stores point their www record to." },
  custom_domain_ipv4_addresses: { label: "IPv4 addresses", description: "For apex domains. One per line." },
  custom_domain_ipv6_addresses: { label: "IPv6 addresses", description: "Optional. One per line." },
  custom_domain_verification_prefix: { label: "Verification record prefix", description: "The TXT record name stores add, for example _platform-verify." },
  custom_domain_verification_window_hours: { label: "Verification window (hours)" },

  platform_email_enabled: { label: "Send platform email" },

  maintenance_mode: { label: "Maintenance mode", description: "Stores and the website show a maintenance page. Platform staff keep access." },
  default_maintenance_behavior: { label: "Module maintenance behaviour" },
  tenant_retention_days: { label: "Closed store retention (days)", description: "Days a closed store's data is kept before it is purged." },
  purged_backup_retention_days: { label: "Backup retention after purge (days)" },
}

/** Labels for option values; unknown values are shown readably. */
export const OPTION_LABELS: Record<string, string> = {
  immediate: "Immediately",
  next_renewal: "At the next renewal",
  none: "No restriction",
  read_only: "Read-only admin",
  blocked: "Block the store",
  manual: "Manual",
  automatic: "Automatic",
  monthly: "Monthly",
  hard_block: "Block the module",
  test: "Test",
  live: "Live",
  "24h": "24-hour (14:30)",
  "12h": "12-hour (2:30 PM)",
}

export const humanize = (key: string) =>
  key
    .replace(/_media_id$/, "")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())

export const fieldLabel = (key: string) => FIELDS[key]?.label ?? humanize(key)
export const optionLabel = (value: string) => OPTION_LABELS[value] ?? humanize(value)

/** Image settings are uploaded through the media endpoint (BG-12), not the group form. */
export const IMAGE_SLOTS: Record<string, string> = {
  platform_logo_media_id: "platform_logo",
  platform_favicon_media_id: "platform_favicon",
  seo_share_image_media_id: "seo_share_image",
}

/** Structured JSON settings and the editor each one uses. */
export const JSON_EDITORS: Record<string, "social" | "currency-map" | "lines"> = {
  social_links: "social",
  reporting_exchange_rates: "currency-map",
  affiliate_minimum_payout: "currency-map",
  custom_domain_ipv4_addresses: "lines",
  custom_domain_ipv6_addresses: "lines",
}

export const SOCIAL_NETWORKS = ["facebook", "instagram", "x", "linkedin", "youtube", "tiktok"] as const

export const SOCIAL_LABELS: Record<(typeof SOCIAL_NETWORKS)[number], string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
}

export const MULTILINE = new Set(["legal_entity_address", "seo_default_description"])
