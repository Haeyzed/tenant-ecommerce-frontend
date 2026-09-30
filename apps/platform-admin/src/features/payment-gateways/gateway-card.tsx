"use client"

import { useState } from "react"

import { useCan } from "@workspace/access/react"
import { isApiError } from "@workspace/api-client"
import { formatDateTime, formatRelative } from "@workspace/format"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { StatusBadge, type StatusTone } from "@workspace/ui/components/status-badge"
import { toast } from "@workspace/ui/components/toast"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { Icon } from "@workspace/ui/icons"

import type { Option } from "@workspace/admin-kit/lookup"

import { useLookup } from "@/features/lookups"
import { useConsole } from "@/shell/console-context"

import { PROVIDER_LABELS, WEBHOOK_SECRET_HINT, isFreshlyVerified, useGatewayAction, useTestGateway, type Gateway } from "./api"

function status(gateway: Gateway): { label: string; tone: StatusTone } {
  if (!gateway.configured) return { label: "Not connected", tone: "muted" }
  if (gateway.enabled) return { label: "Enabled", tone: "success" }
  if (isFreshlyVerified(gateway)) return { label: "Ready to enable", tone: "info" }
  return { label: "Needs a test", tone: "warning" }
}

const ERRORS: Record<string, string> = {
  gateway_not_verified: "Test the credentials successfully before enabling the gateway.",
  gateway_not_enabled: "Only an enabled gateway can be the default.",
  live_payments_disabled: "Live payments are disabled in this environment.",
}

/** One provider in one mode: state, credentials summary, webhook URL and actions (spec §25.1). */
export function GatewayCard({ gateway, onEdit }: { gateway: Gateway; onEdit: () => void }) {
  const { display } = useConsole()
  const test = useTestGateway()
  const action = useGatewayAction()
  const [confirmDisable, setConfirmDisable] = useState(false)
  const countries = useLookup("countries")
  const canUpdate = useCan("landlord.billing.payment-gateways.update")
  const canTest = useCan("landlord.billing.payment-gateways.test")
  const canEnable = useCan("landlord.billing.payment-gateways.enable")
  const canDisable = useCan("landlord.billing.payment-gateways.disable")
  const canDefault = useCan("landlord.billing.payment-gateways.set-default")

  const label = PROVIDER_LABELS[gateway.provider]
  const s = status(gateway)
  const target = { provider: gateway.provider, mode: gateway.mode }

  function fail(title: string, error: unknown) {
    const description = isApiError(error) ? (ERRORS[error.code] ?? error.message) : "Try again in a moment."
    toast.add({ title, description, type: "error" })
  }

  async function runTest() {
    try {
      const result = await test.mutateAsync(target)
      if (result.valid && (result.detected_mode === null || result.detected_mode === gateway.mode)) {
        toast.add({ title: `${label} keys work`, description: "You can enable this gateway for the next 24 hours.", type: "success" })
      } else if (result.valid) {
        toast.add({ title: "These keys are for the other mode", description: `They look like ${result.detected_mode} keys. Save them in the ${result.detected_mode} tab.`, type: "error" })
      } else {
        toast.add({ title: `${label} rejected the keys`, description: result.message, type: "error" })
      }
    } catch (error) {
      fail("The test didn't run", error)
    }
  }

  async function run(kind: "enable" | "disable" | "set-default") {
    try {
      await action.mutateAsync({ ...target, action: kind })
      const done = { enable: "enabled", disable: "disabled", "set-default": "is now the default" }[kind]
      toast.add({ title: `${label} ${done}`, type: "success" })
      setConfirmDisable(false)
    } catch (error) {
      fail(`Couldn't update ${label}`, error)
    }
  }

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(gateway.webhookUrl)
      toast.add({ title: "Webhook URL copied", type: "success" })
    } catch {
      toast.add({ title: "Couldn't copy", description: "Select the URL and copy it manually.", type: "error" })
    }
  }

  const fresh = isFreshlyVerified(gateway)
  const busy = test.isPending || action.isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <span data-testid="gateway-name">{label}</span>
          {gateway.isDefault ? <Badge variant="secondary">Default</Badge> : null}
        </CardTitle>
        <CardDescription>{gateway.configured ? `Order ${gateway.sortOrder}` : "No credentials saved yet."}</CardDescription>
        <CardAction>
          <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {gateway.configured ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Item term="Public key" value={<span className="font-mono text-xs break-all">{gateway.publicKey ?? "—"}</span>} />
            <Item term="Secret key" value={gateway.hasSecretKey ? "Stored" : "Not set"} />
            <Item
              term="Webhook secret"
              value={
                WEBHOOK_SECRET_HINT[gateway.provider] === null ? (
                  <span className="text-muted-foreground">Not needed (signed with the secret key)</span>
                ) : gateway.hasWebhookSecret ? (
                  "Stored"
                ) : (
                  <span className="text-warning">Not set: webhooks will be rejected</span>
                )
              }
            />
            <Item term="Currencies" value={gateway.currencies.join(", ") || "—"} />
            <Item term="Countries" value={countriesText(gateway.countryIds, countries.data ?? [])} />
            <Item
              term="Keys last verified"
              value={gateway.verifiedAt ? <span title={formatDateTime(gateway.verifiedAt, display)}>{formatRelative(gateway.verifiedAt)}</span> : "Never"}
            />
            <Item
              term="Last webhook"
              value={gateway.lastWebhookAt ? <span title={formatDateTime(gateway.lastWebhookAt, display)}>{formatRelative(gateway.lastWebhookAt)}</span> : "None received"}
            />
          </dl>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Webhook URL</span>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 py-1 ps-3 pe-1">
            <code className="min-w-0 flex-1 truncate font-mono text-xs" title={gateway.webhookUrl}>
              {gateway.webhookUrl}
            </code>
            <Button type="button" variant="ghost" size="icon-sm" onClick={copyWebhook} aria-label={`Copy the ${label} webhook URL`}>
              <Icon name="copy" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Paste this into the {label} dashboard ({gateway.mode} mode) so payments are confirmed.</p>
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        {canUpdate ? (
          <Button variant={gateway.configured ? "outline" : "default"} size="sm" onClick={onEdit} disabled={busy}>
            <Icon name={gateway.configured ? "edit" : "key"} data-icon="inline-start" />
            {gateway.configured ? "Update keys" : "Connect"}
          </Button>
        ) : null}
        {gateway.configured && canTest ? (
          <Button variant="outline" size="sm" onClick={runTest} disabled={busy}>
            <Icon name={test.isPending ? "loading" : "check"} data-icon="inline-start" className={test.isPending ? "animate-spin" : undefined} />
            Test keys
          </Button>
        ) : null}
        {gateway.configured && !gateway.enabled && canEnable ? (
          fresh ? (
            <Button size="sm" onClick={() => run("enable")} disabled={busy}>
              Enable
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger render={<span tabIndex={0} />}>
                <Button size="sm" disabled>
                  Enable
                </Button>
              </TooltipTrigger>
              <TooltipContent>Test the keys first. A successful test allows enabling for 24 hours.</TooltipContent>
            </Tooltip>
          )
        ) : null}
        {gateway.enabled && !gateway.isDefault && canDefault ? (
          <Button variant="outline" size="sm" onClick={() => run("set-default")} disabled={busy}>
            Make default
          </Button>
        ) : null}
        {gateway.enabled && canDisable ? (
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmDisable(true)} disabled={busy}>
            Disable
          </Button>
        ) : null}
      </CardFooter>

      <ConfirmDialog
        open={confirmDisable}
        onOpenChange={setConfirmDisable}
        title={`Disable ${label} (${gateway.mode})?`}
        description="New checkouts stop using this gateway. Subscriptions already billed through it keep working."
        confirmLabel="Disable"
        destructive
        pending={action.isPending}
        onConfirm={() => run("disable")}
      />
    </Card>
  )
}

/** "All countries", or up to three names and a count of the rest. */
function countriesText(ids: number[] | null, options: readonly Option[]): string {
  if (ids === null || ids.length === 0) return "All countries"
  const names = ids.map((id) => options.find((o) => o.value === String(id))?.label ?? `#${id}`)
  return names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`
}

function Item({ term, value }: { term: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="min-w-0">{value}</dd>
    </div>
  )
}
