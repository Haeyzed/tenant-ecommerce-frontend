"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { useCan } from "@workspace/access/react"
import { StateView } from "@workspace/admin-kit/states"
import { DataTable, type DataColumn } from "@workspace/admin-kit/table"
import { isApiError } from "@workspace/api-client"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "@workspace/ui/components/toast"

import { AUDIENCES, AUDIENCE_LABELS, CHANNELS, CHANNEL_LABELS, matrixQuery, templateGroup, templateName, useUpdateMatrix, type MatrixRow } from "./api"

/** Which channels each message goes out on, and to whom (spec §17.2, §17.5). */
export function ChannelsTab() {
  const query = useQuery(matrixQuery)
  const { mutate } = useUpdateMatrix()
  const canUpdate = useCan("landlord.notifications.matrix.update")
  const [audienceFor, setAudienceFor] = useState<MatrixRow | null>(null)

  const columns = useMemo<DataColumn<MatrixRow>[]>(() => {
    function toggle(row: MatrixRow, channel: string, enabled: boolean) {
      mutate(
        { key: row.key, channels: { [channel]: enabled } },
        {
          onError: (error) =>
            toast.add({
              title: `Couldn't change ${CHANNEL_LABELS[channel] ?? channel} for ${templateName(row.key)}`,
              description: isApiError(error) ? (error.fieldErrors?.channels?.[0] ?? error.message) : undefined,
              type: "error",
            }),
        }
      )
    }

    return [
      {
        id: "message",
        header: "Message",
        mobile: "title",
        cell: (r) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{templateName(r.key)}</span>
            <span className="truncate text-xs text-muted-foreground">{templateGroup(r.key)}</span>
          </span>
        ),
      },
      {
        id: "state",
        header: "",
        mobile: "meta",
        cell: (r) => (r.is_mandatory ? <Badge variant="outline">Required</Badge> : !r.is_active ? <Badge variant="secondary">Off</Badge> : null),
      },
      ...CHANNELS.map<DataColumn<MatrixRow>>((channel) => ({
        id: channel,
        header: CHANNEL_LABELS[channel] ?? channel,
        mobile: "detail",
        align: "end",
        cell: (r) => {
          const on = r.channels[channel] ?? false
          // A required message keeps at least one channel (the API refuses otherwise).
          const isLast = r.is_mandatory && on && Object.values(r.channels).filter(Boolean).length === 1
          return (
            <Switch
              checked={on}
              disabled={!canUpdate || isLast}
              onCheckedChange={(next) => toggle(r, channel, next)}
              aria-label={`${CHANNEL_LABELS[channel] ?? channel} for ${templateName(r.key)}`}
              title={isLast ? "A required message needs at least one channel." : undefined}
            />
          )
        },
      })),
      {
        id: "audience",
        header: "Sent to",
        mobile: "detail",
        cell: (r) => (
          <span className="flex flex-wrap items-center gap-1">
            {r.target_audience.map((a) => (
              <Badge key={a} variant="secondary">
                {AUDIENCE_LABELS[a] ?? a}
              </Badge>
            ))}
            {canUpdate ? (
              <Button variant="ghost" size="xs" onClick={() => setAudienceFor(r)}>
                Change
              </Button>
            ) : null}
          </span>
        ),
      },
    ]
  }, [canUpdate, mutate])

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        A channel only delivers when it is set up for the platform and the recipient has an address for it, for example a phone number for SMS. Recipients can mute
        optional messages in their own preferences.
      </p>
      <DataTable<MatrixRow>
        tableId="notification-matrix"
        columns={columns}
        rows={query.data}
        getRowId={(r) => r.key}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        filtered={false}
        emptyState={<StateView icon="notifications" title="No messages" description="Run the notification template seeder to load the platform messages." />}
        noResultsState={<StateView icon="search" title="No messages" description="" />}
      />
      <AudienceDialog row={audienceFor} onClose={() => setAudienceFor(null)} />
    </div>
  )
}

function AudienceDialog({ row, onClose }: { row: MatrixRow | null; onClose: () => void }) {
  return (
    <Dialog open={row !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent>{row ? <AudienceForm key={row.key} row={row} onDone={onClose} /> : null}</DialogContent>
    </Dialog>
  )
}

function AudienceForm({ row, onDone }: { row: MatrixRow; onDone: () => void }) {
  const update = useUpdateMatrix()
  const [selected, setSelected] = useState<string[]>(row.target_audience)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (selected.length === 0) {
      setError("Choose at least one audience.")
      return
    }
    try {
      await update.mutateAsync({ key: row.key, audience: selected })
      toast.add({ title: `${templateName(row.key)} updated`, type: "success" })
      onDone()
    } catch (e) {
      setError(isApiError(e) ? (e.fieldErrors?.audience?.[0] ?? e.message) : "Couldn't save the audience.")
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Who gets “{templateName(row.key)}”</DialogTitle>
        <DialogDescription>The message is sent to each chosen group when the event applies to them.</DialogDescription>
      </DialogHeader>
      <FieldGroup className="gap-3">
        {AUDIENCES.map((a) => (
          <Field key={a} orientation="horizontal">
            <Checkbox
              id={`audience-${a}`}
              checked={selected.includes(a)}
              onCheckedChange={(checked) => {
                setError(null)
                setSelected((s) => (checked ? [...s, a] : s.filter((x) => x !== a)))
              }}
            />
            <FieldLabel htmlFor={`audience-${a}`} className="font-normal">
              {AUDIENCE_LABELS[a] ?? a}
            </FieldLabel>
          </Field>
        ))}
        {error ? <FieldError>{error}</FieldError> : null}
      </FieldGroup>
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={update.isPending}>
          Cancel
        </Button>
        <Button onClick={() => void save()} disabled={update.isPending}>
          {update.isPending ? <Spinner data-icon="inline-start" /> : null}
          Save
        </Button>
      </DialogFooter>
    </>
  )
}
