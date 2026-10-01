"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { parseAsBoolean, parseAsInteger, parseAsString, useQueryStates } from "nuqs"
import { useEffect, useMemo, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { useCan } from "@workspace/access/react"
import { FormErrors, applyApiErrors } from "@workspace/admin-kit/forms"
import { MultiCombobox } from "@workspace/admin-kit/lookup"
import { StateView } from "@workspace/admin-kit/states"
import { DataTable, FilterSelect, type DataColumn } from "@workspace/admin-kit/table"
import { isApiError } from "@workspace/api-client"
import { formatRelative } from "@workspace/format"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogDescription, ResponsiveDialogFooter, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@workspace/ui/components/responsive-dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Spinner } from "@workspace/ui/components/spinner"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import { toast } from "@workspace/ui/components/toast"
import { Icon } from "@workspace/ui/icons"

import { optionLabel, useAdminLookup } from "@/features/lookups"

import { platformUsersQuery, useDeactivateUser, useInviteUser, useSetRoles, useUpdateUser, type PlatformUser } from "./api"

const ERRORS: Record<string, string> = {
  last_super_admin: "At least one active super-admin must remain.",
  cannot_deactivate_self: "You can't deactivate your own account.",
  role_unknown: "That role no longer exists.",
}

const params = {
  search: parseAsString.withDefault(""),
  active: parseAsBoolean,
  role: parseAsString,
  page: parseAsInteger.withDefault(1),
  per_page: parseAsInteger.withDefault(25),
}

/** The platform team (spec §25.1): invitations, roles and deactivation. */
export function PlatformUsersPage() {
  const [filters, setFilters] = useQueryStates(params, { clearOnDefault: true, history: "replace" })
  const [search, setSearch] = useState(filters.search)
  const [inviting, setInviting] = useState(false)
  const [editing, setEditing] = useState<PlatformUser | null>(null)
  const [deactivating, setDeactivating] = useState<PlatformUser | null>(null)
  const roles = useAdminLookup("platform-roles")
  const canInvite = useCan("landlord.platform-users.store")
  const canUpdate = useCan("landlord.platform-users.update")
  const canDeactivate = useCan("landlord.platform-users.deactivate")

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== filters.search) void setFilters({ search, page: 1 })
    }, 300)
    return () => clearTimeout(timer)
  }, [search, filters.search, setFilters])

  const query = useQuery({
    ...platformUsersQuery({
      search: filters.search || undefined,
      is_active: filters.active ?? undefined,
      role: filters.role ?? undefined,
      page: filters.page,
      per_page: filters.per_page,
    }),
    placeholderData: keepPreviousData,
  })

  const columns = useMemo<DataColumn<PlatformUser>[]>(
    () => [
      {
        id: "user",
        header: "Person",
        mobile: "title",
        cell: (u) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{u.name}</span>
            <span className="truncate text-xs text-muted-foreground">{u.email}</span>
          </span>
        ),
      },
      {
        id: "roles",
        header: "Roles",
        mobile: "subtitle",
        cell: (u) =>
          u.roles.length === 0 ? (
            <span className="text-muted-foreground">No role</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {u.roles.map((r) => (
                <Badge key={r} variant="secondary">
                  {optionLabel(roles.data, r)}
                </Badge>
              ))}
            </span>
          ),
      },
      {
        id: "status",
        header: "Status",
        mobile: "meta",
        cell: (u) =>
          !u.is_active ? (
            <StatusBadge tone="muted">Deactivated</StatusBadge>
          ) : !u.has_password ? (
            <StatusBadge tone="warning">Invited</StatusBadge>
          ) : (
            <StatusBadge tone="success">Active</StatusBadge>
          ),
      },
      { id: "login", header: "Last sign-in", mobile: "detail", cell: (u) => (u.last_login_at ? formatRelative(u.last_login_at) : "Never") },
    ],
    [roles.data]
  )

  const filtered = Boolean(filters.search || filters.active !== null || filters.role)

  return (
    <>
      <PageHeader
        title="Platform users"
        description="People who can sign in to this console. Roles decide what each person can see and do."
        actions={
          canInvite ? (
            <Button onClick={() => setInviting(true)}>
              <Icon name="userAdd" data-icon="inline-start" />
              Invite
            </Button>
          ) : null
        }
      />
      <DataTable<PlatformUser>
        tableId="platform-users"
        columns={columns}
        rows={query.data?.items}
        getRowId={(u) => String(u.id)}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        filtered={filtered}
        rowActions={(u) => (
          <div className="flex justify-end gap-1">
            {canUpdate ? (
              <Button variant="ghost" size="sm" onClick={() => setEditing(u)}>
                Edit
              </Button>
            ) : null}
            {canDeactivate && u.is_active ? (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeactivating(u)}>
                Deactivate
              </Button>
            ) : null}
          </div>
        )}
        paging={{
          pagination: query.data?.pagination,
          onPageChange: (page) => void setFilters({ page }),
          onPerPageChange: (per_page) => void setFilters({ per_page, page: 1 }),
        }}
        toolbar={
          <>
            <InputGroup className="w-full sm:w-64">
              <InputGroupAddon>
                <Icon name="search" />
              </InputGroupAddon>
              <InputGroupInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or email" aria-label="Search people" />
            </InputGroup>
            <FilterSelect
              label="Role"
              anyLabel="Any role"
              value={filters.role}
              options={roles.data ?? []}
              onChange={(role) => void setFilters({ role, page: 1 })}
            />
            <FilterSelect
              label="Status"
              anyLabel="Active and deactivated"
              value={filters.active === null ? null : filters.active ? "yes" : "no"}
              options={[
                { value: "yes", label: "Active only" },
                { value: "no", label: "Deactivated only" },
              ]}
              onChange={(v) => void setFilters({ active: v === null ? null : v === "yes", page: 1 })}
            />
          </>
        }
        emptyState={<StateView icon="user" title="No platform users" description="Invite your team so they can sign in." />}
        noResultsState={<StateView icon="search" title="No one matches" description="Try another name, role or status." />}
      />

      <ResponsiveDialog open={inviting} onOpenChange={setInviting}>
        <ResponsiveDialogContent className="sm:max-w-md">{inviting ? <InviteForm onDone={() => setInviting(false)} /> : null}</ResponsiveDialogContent>
      </ResponsiveDialog>
      <ResponsiveDialog open={editing !== null} onOpenChange={(o) => (o ? null : setEditing(null))}>
        <ResponsiveDialogContent className="sm:max-w-md">{editing ? <EditForm key={editing.id} user={editing} onDone={() => setEditing(null)} /> : null}</ResponsiveDialogContent>
      </ResponsiveDialog>
      {deactivating ? <DeactivateDialog key={deactivating.id} user={deactivating} onClose={() => setDeactivating(null)} /> : null}
    </>
  )
}

const inviteSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(120),
  email: z.email("Enter a valid email address."),
  roles: z.array(z.string()).min(1, "Give at least one role."),
})
type InviteValues = z.infer<typeof inviteSchema>

function InviteForm({ onDone }: { onDone: () => void }) {
  const invite = useInviteUser()
  const roles = useAdminLookup("platform-roles")
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useForm<InviteValues>({ resolver: zodResolver(inviteSchema), defaultValues: { name: "", email: "", roles: [] } })

  async function onSubmit(values: InviteValues) {
    setFormErrors([])
    try {
      await invite.mutateAsync(values)
      toast.add({ title: `Invitation sent to ${values.email}`, description: "They set their password from the email.", type: "success" })
      onDone()
    } catch (error) {
      setFormErrors(applyApiErrors(form, error))
    }
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>Invite a platform user</ResponsiveDialogTitle>
        <ResponsiveDialogDescription>They get an email with a link to set their password and sign in.</ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      <FormErrors messages={formErrors} />
      <FieldGroup>
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="invite-name">Name</FieldLabel>
              <Input {...field} id="invite-name" autoComplete="off" aria-invalid={fieldState.invalid || undefined} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="invite-email">Email</FieldLabel>
              <Input {...field} id="invite-email" type="email" autoComplete="off" aria-invalid={fieldState.invalid || undefined} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="roles"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="invite-roles">Roles</FieldLabel>
              <MultiCombobox id="invite-roles" options={roles.data ?? []} loading={roles.isPending} value={field.value} onChange={field.onChange} placeholder="Choose roles" invalid={fieldState.invalid} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>
      <ResponsiveDialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={invite.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={invite.isPending}>
          {invite.isPending ? <Spinner data-icon="inline-start" /> : null}
          Send invitation
        </Button>
      </ResponsiveDialogFooter>
    </form>
  )
}

const editSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(120),
  email: z.email("Enter a valid email address."),
  roles: z.array(z.string()),
})
type EditValues = z.infer<typeof editSchema>

function EditForm({ user, onDone }: { user: PlatformUser; onDone: () => void }) {
  const update = useUpdateUser(user.id)
  const setRoles = useSetRoles(user.id)
  const roles = useAdminLookup("platform-roles")
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useForm<EditValues>({ resolver: zodResolver(editSchema), defaultValues: { name: user.name, email: user.email, roles: user.roles } })

  async function onSubmit(values: EditValues) {
    setFormErrors([])
    try {
      if (values.name !== user.name || values.email !== user.email) {
        await update.mutateAsync({
          ...(values.name !== user.name ? { name: values.name } : {}),
          ...(values.email !== user.email ? { email: values.email } : {}),
        })
      }
      await setRoles.mutateAsync({ from: user.roles, to: values.roles })
      toast.add({ title: `${values.name} saved`, type: "success" })
      onDone()
    } catch (error) {
      setFormErrors(isApiError(error) && ERRORS[error.code] ? [ERRORS[error.code] ?? error.message] : applyApiErrors(form, error))
    }
  }

  const pending = update.isPending || setRoles.isPending

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>Edit {user.name}</ResponsiveDialogTitle>
        <ResponsiveDialogDescription>{user.has_password ? "Role changes apply at their next request." : "This person hasn't set a password yet."}</ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      <FormErrors messages={formErrors} />
      <FieldGroup>
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="edit-name">Name</FieldLabel>
              <Input {...field} id="edit-name" aria-invalid={fieldState.invalid || undefined} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="edit-email">Email</FieldLabel>
              <Input {...field} id="edit-email" type="email" aria-invalid={fieldState.invalid || undefined} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="roles"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="edit-roles">Roles</FieldLabel>
              <MultiCombobox id="edit-roles" options={roles.data ?? []} loading={roles.isPending} value={field.value} onChange={field.onChange} placeholder="No role" />
              <FieldDescription>Without a role, the person can sign in but sees nothing.</FieldDescription>
            </Field>
          )}
        />
      </FieldGroup>
      <ResponsiveDialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Save
        </Button>
      </ResponsiveDialogFooter>
    </form>
  )
}

function DeactivateDialog({ user, onClose }: { user: PlatformUser; onClose: () => void }) {
  const deactivate = useDeactivateUser(user.id)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    try {
      await deactivate.mutateAsync()
      toast.add({ title: `${user.name} deactivated`, type: "success" })
      onClose()
    } catch (e) {
      setError(isApiError(e) ? (ERRORS[e.code] ?? e.message) : "Couldn't deactivate. Try again.")
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => (o ? null : onClose())}
      title={`Deactivate ${user.name}?`}
      description="They are signed out and can no longer sign in. Their history is kept."
      confirmLabel="Deactivate"
      destructive
      pending={deactivate.isPending}
      onConfirm={() => void confirm()}
    >
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </ConfirmDialog>
  )
}
