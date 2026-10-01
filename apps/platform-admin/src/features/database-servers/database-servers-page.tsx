"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { useCan } from "@workspace/access/react"
import { FormErrors, applyApiErrors } from "@workspace/admin-kit/forms"
import { StateView } from "@workspace/admin-kit/states"
import { DataTable, type DataColumn } from "@workspace/admin-kit/table"
import { unwrap } from "@workspace/api-client"
import type { operations } from "@workspace/contract/landlord"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Progress } from "@workspace/ui/components/progress"
import { Spinner } from "@workspace/ui/components/spinner"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "@workspace/ui/components/toast"
import { Icon } from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"

import { api } from "@/shell/api-client"

type Server = operations["landlord.tenancy.database-servers.index"]["responses"][200]["content"]["application/json"]["data"][number]
type StoreBody = operations["landlord.tenancy.database-servers.store"]["requestBody"]["content"]["application/json"]

const serversKey = ["database-servers"] as const
const serversQuery = {
  queryKey: serversKey,
  queryFn: ({ signal }: { signal: AbortSignal }) => unwrap(api.GET("/admin/database-servers", { signal })),
}

/**
 * Where store databases live (spec §25.1, §7.4). New stores are placed on
 * a server that accepts tenants and has room; existing stores never move.
 */
export function DatabaseServersPage() {
  const query = useQuery(serversQuery)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Server | null>(null)
  const canAdd = useCan("landlord.tenancy.database-servers.store")
  const canEdit = useCan("landlord.tenancy.database-servers.update")

  const columns: DataColumn<Server>[] = [
    {
      id: "name",
      header: "Server",
      mobile: "title",
      cell: (s) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{s.name}</span>
          <span className="truncate font-mono text-xs text-muted-foreground">
            {s.host}:{s.port}
            {s.read_host ? ` · read ${s.read_host}` : ""}
          </span>
        </span>
      ),
    },
    {
      id: "capacity",
      header: "Stores",
      mobile: "subtitle",
      cell: (s) => (
        <span className="flex w-40 flex-col gap-1">
          <span className="text-sm tabular-nums">
            {s.tenant_count} / {s.max_tenants} <span className="text-muted-foreground">({s.utilisation}%)</span>
          </span>
          <Progress
            value={Math.min(100, s.utilisation)}
            aria-label={`${s.name} capacity used`}
            className={cn(s.utilisation >= 90 && "[&_[data-slot=progress-indicator]]:bg-warning", s.utilisation >= 100 && "[&_[data-slot=progress-indicator]]:bg-destructive")}
          />
        </span>
      ),
    },
    {
      id: "accepting",
      header: "New stores",
      mobile: "meta",
      cell: (s) => <StatusBadge tone={s.is_accepting_tenants ? "success" : "muted"}>{s.is_accepting_tenants ? "Accepting" : "Not accepting"}</StatusBadge>,
    },
    { id: "user", header: "User", hideable: true, defaultHidden: true, mobile: "hidden", cell: (s) => <span className="font-mono text-xs">{s.username}</span> },
  ]

  return (
    <>
      <PageHeader
        title="Database servers"
        description="Each store gets its own database on one of these servers. New stores go to a server that is accepting and has room; existing stores never move."
        actions={
          canAdd ? (
            <Button onClick={() => setAdding(true)}>
              <Icon name="add" data-icon="inline-start" />
              Add server
            </Button>
          ) : null
        }
      />
      <DataTable<Server>
        tableId="database-servers"
        columns={columns}
        rows={query.data}
        getRowId={(s) => String(s.id)}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        filtered={false}
        rowActions={(s) =>
          canEdit ? (
            <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>
              Edit
            </Button>
          ) : null
        }
        emptyState={<StateView icon="device" title="No database servers" description="Add a server so new stores can be set up." />}
        noResultsState={<StateView icon="search" title="No servers" description="" />}
      />
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-lg">{adding ? <AddServerForm onDone={() => setAdding(false)} /> : null}</DialogContent>
      </Dialog>
      <Dialog open={editing !== null} onOpenChange={(o) => (o ? null : setEditing(null))}>
        <DialogContent className="sm:max-w-md">{editing ? <EditServerForm key={editing.id} server={editing} onDone={() => setEditing(null)} /> : null}</DialogContent>
      </Dialog>
    </>
  )
}

const addSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(120),
  host: z.string().trim().min(1, "Enter the host.").max(255),
  port: z.string().trim().regex(/^\d{1,5}$/, "Enter a port number.").refine((v) => Number(v) >= 1 && Number(v) <= 65535, "Enter a port from 1 to 65535."),
  read_host: z.string().trim().max(255),
  username: z.string().trim().min(1, "Enter the user name.").max(120),
  password: z.string().min(1, "Enter the password.").max(1024),
  max_tenants: z.string().trim().regex(/^[1-9]\d*$/, "Enter 1 or more."),
  is_accepting_tenants: z.boolean(),
})
type AddValues = z.infer<typeof addSchema>

function AddServerForm({ onDone }: { onDone: () => void }) {
  const client = useQueryClient()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useForm<AddValues>({
    resolver: zodResolver(addSchema),
    defaultValues: { name: "", host: "", port: "3306", read_host: "", username: "", password: "", max_tenants: "200", is_accepting_tenants: true },
  })
  const add = useMutation({
    mutationFn: async (body: StoreBody) => unwrap(api.POST("/admin/database-servers", { body })),
    onSuccess: () => void client.invalidateQueries({ queryKey: serversKey }),
  })

  async function onSubmit(v: AddValues) {
    setFormErrors([])
    try {
      await add.mutateAsync({ ...v, port: Number(v.port), max_tenants: Number(v.max_tenants), read_host: v.read_host || null })
      toast.add({ title: `${v.name} added`, type: "success" })
      onDone()
    } catch (error) {
      setFormErrors(applyApiErrors(form, error))
    }
  }

  const text = (name: "name" | "host" | "port" | "read_host" | "username" | "password" | "max_tenants", label: string, opts: { type?: string; description?: string; mono?: boolean } = {}) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined}>
          <FieldLabel htmlFor={`server-${name}`}>{label}</FieldLabel>
          <Input
            {...field}
            id={`server-${name}`}
            type={opts.type ?? "text"}
            autoComplete={name === "password" ? "new-password" : "off"}
            spellCheck={false}
            className={opts.mono ? "font-mono" : undefined}
            aria-invalid={fieldState.invalid || undefined}
          />
          {opts.description ? <FieldDescription>{opts.description}</FieldDescription> : null}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>Add database server</DialogTitle>
        <DialogDescription>The user needs rights to create databases. The password is stored encrypted and never shown again.</DialogDescription>
      </DialogHeader>
      <FormErrors messages={formErrors} />
      <FieldGroup>
        {text("name", "Name", { description: "For example “db-eu-1”." })}
        <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
          {text("host", "Host", { mono: true })}
          {text("port", "Port", { mono: true })}
        </div>
        {text("read_host", "Read replica host (optional)", { mono: true })}
        <div className="grid gap-4 sm:grid-cols-2">
          {text("username", "User", { mono: true })}
          {text("password", "Password", { type: "password" })}
        </div>
        {text("max_tenants", "Maximum stores")}
        <Controller
          control={form.control}
          name="is_accepting_tenants"
          render={({ field }) => (
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>Accept new stores</FieldTitle>
                <FieldDescription>New sign-ups can be placed on this server.</FieldDescription>
              </FieldContent>
              <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Accept new stores" />
            </Field>
          )}
        />
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={add.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? <Spinner data-icon="inline-start" /> : null}
          Add server
        </Button>
      </DialogFooter>
    </form>
  )
}

function EditServerForm({ server, onDone }: { server: Server; onDone: () => void }) {
  const client = useQueryClient()
  const [max, setMax] = useState(String(server.max_tenants))
  const [accepting, setAccepting] = useState(server.is_accepting_tenants)
  const [error, setError] = useState<string | null>(null)
  const update = useMutation({
    mutationFn: async (body: { max_tenants: number; is_accepting_tenants: boolean }) =>
      unwrap(api.PATCH("/admin/database-servers/{server}", { params: { path: { server: server.id } }, body })),
    onSuccess: () => void client.invalidateQueries({ queryKey: serversKey }),
  })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!/^[1-9]\d*$/.test(max.trim())) {
      setError("Enter 1 or more.")
      return
    }
    try {
      await update.mutateAsync({ max_tenants: Number(max), is_accepting_tenants: accepting })
      toast.add({ title: `${server.name} updated`, type: "success" })
      onDone()
    } catch {
      setError("Couldn't update the server. Try again.")
    }
  }

  const below = Number(max) < server.tenant_count

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>{server.name}</DialogTitle>
        <DialogDescription>
          {server.tenant_count} stores on {server.host}. Connection details can't be changed here.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="server-max">Maximum stores</FieldLabel>
          <Input
            id="server-max"
            inputMode="numeric"
            value={max}
            onChange={(e) => {
              setMax(e.target.value)
              setError(null)
            }}
            className="w-32"
          />
          {error ? <FieldError>{error}</FieldError> : below ? <FieldDescription className="text-warning">Below the current count: no new stores will be placed here.</FieldDescription> : null}
        </Field>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldTitle>Accept new stores</FieldTitle>
            <FieldDescription>Turn off to drain the server; its stores keep working.</FieldDescription>
          </FieldContent>
          <Switch checked={accepting} onCheckedChange={setAccepting} aria-label="Accept new stores" />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={update.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? <Spinner data-icon="inline-start" /> : null}
          Save
        </Button>
      </DialogFooter>
    </form>
  )
}
