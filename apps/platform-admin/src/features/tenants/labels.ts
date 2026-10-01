import type { StatusTone } from "@workspace/ui/components/status-badge"

type Label = { label: string; tone: StatusTone }

/** Tenant lifecycle (App\Modules\Tenancy\Enums\TenantStatus). */
export const TENANT_STATUS: Record<string, Label> = {
  awaiting_payment: { label: "Awaiting payment", tone: "warning" },
  provisioning: { label: "Provisioning", tone: "info" },
  provisioning_failed: { label: "Provisioning failed", tone: "danger" },
  active: { label: "Active", tone: "success" },
  suspended: { label: "Suspended", tone: "danger" },
  closed: { label: "Closed", tone: "muted" },
  purged: { label: "Purged", tone: "muted" },
}

/** Effective module state for a tenant (App\Modules\Plans\Enums\ModuleState). */
export const MODULE_STATE: Record<string, Label> = {
  enabled: { label: "Enabled", tone: "success" },
  available: { label: "Available", tone: "info" },
  disabled: { label: "Turned off", tone: "neutral" },
  locked: { label: "Read-only", tone: "warning" },
  suspended: { label: "Suspended", tone: "danger" },
  unavailable: { label: "Not in plan", tone: "muted" },
}

/** Where the entitlement comes from (FeatureAccessService). */
export const MODULE_SOURCE: Record<string, string> = { plan: "Plan", override: "Override", none: "—" }

/** Feature override effects (App\Modules\Plans\Enums\OverrideEffect). */
export const OVERRIDE_EFFECT: Record<string, Label> = {
  grant: { label: "Granted", tone: "success" },
  revoke: { label: "Revoked", tone: "danger" },
  suspend: { label: "Suspended", tone: "warning" },
}

export const MODULE_CLASS_LABELS: Record<string, string> = { core: "Core", module: "Modules", capability: "Capabilities", integration: "Integrations" }
