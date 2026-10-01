"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import type { ReactNode } from "react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Separator } from "@workspace/ui/components/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { Icon } from "@workspace/ui/icons"

import type { VisibleEntry, VisibleGroup } from "../nav"

export type ShellUser = {
  name: string
  email: string
  avatarUrl?: string | null
}
export type ShellBrand = {
  name: string
  subtitle?: string
  logoUrl?: string | null
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?"

function isActive(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`)
}

function NavItem({
  entry,
  pathname,
}: {
  entry: VisibleEntry
  pathname: string
}) {
  const active = isActive(pathname, entry.href)

  if (entry.children && entry.children.length > 0) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={entry.label}
          isActive={active}
          render={<Link href={entry.href} />}
        >
          <Icon name={entry.icon} />
          <span>{entry.label}</span>
        </SidebarMenuButton>
        {active ? (
          <SidebarMenuSub>
            {entry.children.map((child) => (
              <SidebarMenuSubItem key={child.id}>
                <SidebarMenuSubButton
                  isActive={isActive(pathname, child.href)}
                  render={<Link href={child.href} />}
                >
                  <span>{child.label}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        ) : null}
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={entry.label}
        isActive={active}
        render={<Link href={entry.href} />}
      >
        <Icon name={entry.icon} />
        <span className="truncate">{entry.label}</span>
        {entry.inactive ? (
          <Badge variant="outline" className="ms-auto text-[0.65rem]">
            Inactive
          </Badge>
        ) : null}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

/** "Catalogue › Products" from the visible navigation and the current path. */
function NavBreadcrumb({
  groups,
  pathname,
}: {
  groups: VisibleGroup[]
  pathname: string
}) {
  let match: { group: VisibleGroup; entry: VisibleEntry } | null = null

  for (const group of groups) {
    for (const entry of group.entries) {
      const candidates = [entry, ...(entry.children ?? [])]
      for (const candidate of candidates) {
        if (
          isActive(pathname, candidate.href) &&
          (!match || candidate.href.length > match.entry.href.length)
        ) {
          match = { group, entry: candidate }
        }
      }
    }
  }

  if (!match) return null

  // "Tenants › Tenants" adds nothing: skip the group when it repeats the page.
  const showGroup = match.group.label !== match.entry.label
  // Below a list (a record or a form), the list crumb links back to it.
  const isNested = pathname !== match.entry.href

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {showGroup ? (
          <>
            <BreadcrumbItem className="hidden sm:inline-flex">
              {match.group.label}
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden sm:inline-flex" />
          </>
        ) : null}
        <BreadcrumbItem>
          {isNested ? (
            <BreadcrumbLink render={<Link href={match.entry.href} />}>
              {match.entry.label}
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>{match.entry.label}</BreadcrumbPage>
          )}
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function ThemeMenuItems() {
  const { setTheme, resolvedTheme } = useTheme()

  return (
    <DropdownMenuItem
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Icon name={resolvedTheme === "dark" ? "sun" : "moon"} />
      {resolvedTheme === "dark" ? "Light theme" : "Dark theme"}
    </DropdownMenuItem>
  )
}

function UserMenu({
  user,
  menu,
  onLogout,
}: {
  user: ShellUser
  menu?: ReactNode
  onLogout: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            size="lg"
            className="data-popup-open:bg-sidebar-accent"
          >
            <Avatar className="size-8 rounded-lg">
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt="" />
              ) : null}
              <AvatarFallback className="rounded-lg">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <span className="grid flex-1 text-start text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </span>
            <Icon name="moreVertical" className="ms-auto size-4" />
          </SidebarMenuButton>
        }
      />
      <DropdownMenuContent side="top" align="start" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-foreground">
              {user.name}
            </span>
            <span className="truncate text-xs font-normal">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {menu}
          <ThemeMenuItems />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" onClick={onLogout}>
            <Icon name="logout" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The admin shell (spec §17.1): sidebar from the filtered registry, header,
 * banner stack and content. Collapses to an icon rail on desktop and to a
 * sheet on mobile.
 */
export function AppShell({
  brand,
  groups,
  user,
  userMenu,
  onLogout,
  defaultOpen = true,
  homeHref = "/",
  headerStart,
  headerEnd,
  banners,
  children,
}: {
  brand: ShellBrand
  groups: VisibleGroup[]
  user: ShellUser
  userMenu?: ReactNode
  onLogout: () => void
  defaultOpen?: boolean
  /** Where the brand links to. */
  homeHref?: string
  headerStart?: ReactNode
  headerEnd?: ReactNode
  banners?: ReactNode
  children: ReactNode
}) {
  const pathname = usePathname()

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" render={<Link href={homeHref} />}>
                <Avatar className="size-8 rounded-lg">
                  {brand.logoUrl ? (
                    <AvatarImage src={brand.logoUrl} alt="" />
                  ) : null}
                  <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                    {initials(brand.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="grid flex-1 text-start text-sm leading-tight">
                  <span className="truncate font-semibold">{brand.name}</span>
                  {brand.subtitle ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {brand.subtitle}
                    </span>
                  ) : null}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          {groups.map((group) => (
            <SidebarGroup key={group.id}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.entries.map((entry) => (
                    <NavItem key={entry.id} entry={entry} pathname={pathname} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <UserMenu user={user} menu={userMenu} onLogout={onLogout} />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <SidebarTrigger className="-ms-1" />
          <Separator
            orientation="vertical"
            className="me-1 data-[orientation=vertical]:h-4"
          />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {headerStart ?? (
              <NavBreadcrumb groups={groups} pathname={pathname} />
            )}
          </div>
          <div className="flex items-center gap-1">{headerEnd}</div>
        </header>
        {banners ? <div className="flex flex-col">{banners}</div> : null}
        <div className="mx-auto flex w-full max-w-[1400px] min-w-0 flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export function HeaderIconButton({
  label,
  children,
  ...props
}: { label: string; children: ReactNode } & Omit<
  React.ComponentProps<typeof Button>,
  "children"
>) {
  return (
    <Button variant="ghost" size="icon" aria-label={label} {...props}>
      {children}
    </Button>
  )
}

export { NotificationBell, unreadLabel, type BellItem } from "./notification-bell"
