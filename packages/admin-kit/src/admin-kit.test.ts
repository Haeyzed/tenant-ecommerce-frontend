import { describe, expect, it } from "vitest"

import { tenantRoutes } from "@workspace/contract/routes/tenant"

import { navRoutes, visibleNav, type NavEntry } from "./nav"
import { summarizeBulk } from "./table/bulk"

const groups = [
  { id: "catalog", label: "Catalogue" },
  { id: "operations", label: "Operations" },
]

const entries: NavEntry[] = [
  {
    id: "products",
    label: "Products",
    icon: "products",
    href: "/products",
    route: "tenant.catalog.admin.products.index",
    group: "catalog",
    order: 1,
  },
  {
    id: "shifts",
    label: "Shifts",
    icon: "hr",
    href: "/hr/shifts",
    route: "tenant.admin.hr.shifts.index",
    group: "operations",
    order: 2,
  },
]

const snapshot = (
  permissions: string[],
  modules: Record<string, "enabled" | "disabled" | "locked" | "suspended"> = {}
) => ({
  permissions: new Set(permissions),
  roles: [],
  modules,
  isOwner: false,
})

describe("visibleNav", () => {
  it("shows only entries the user may read, in their groups", () => {
    const nav = visibleNav(
      groups,
      entries,
      snapshot(["products.view", "hr.shifts.view"], { hr: "enabled" }),
      tenantRoutes
    )
    expect(nav.map((g) => [g.id, g.entries.map((e) => e.id)])).toEqual([
      ["catalog", ["products"]],
      ["operations", ["shifts"]],
    ])
  })

  it("moves readable inactive modules to the Inactive group and hides the rest", () => {
    const locked = visibleNav(
      groups,
      entries,
      snapshot(["products.view", "hr.shifts.view"], { hr: "locked" }),
      tenantRoutes
    )
    expect(locked.at(-1)).toMatchObject({
      id: "inactive",
      entries: [{ id: "shifts", inactive: true }],
    })

    const suspended = visibleNav(
      groups,
      entries,
      snapshot(["products.view", "hr.shifts.view"], { hr: "suspended" }),
      tenantRoutes
    )
    expect(suspended.map((g) => g.id)).toEqual(["catalog"])
  })

  it("hides everything without permissions (a clerk and an owner differ)", () => {
    expect(visibleNav(groups, entries, snapshot([]), tenantRoutes)).toEqual([])
  })

  it("references only routes that exist in the manifest", () => {
    for (const route of navRoutes(entries))
      expect(tenantRoutes).toHaveProperty([route])
  })
})

describe("summarizeBulk", () => {
  const result = (ok: number, failed: number) => ({
    operation_id: "op",
    succeeded: ok,
    failed,
    results: [
      ...Array.from({ length: ok }, (_, i) => ({
        id: i,
        status: "ok" as const,
        error: null,
        message: null,
      })),
      ...Array.from({ length: failed }, (_, i) => ({
        id: 100 + i,
        status: "error" as const,
        error: "not_found",
        message: "Not found.",
      })),
    ],
  })

  it("reports full success, partial failure and total failure", () => {
    expect(
      summarizeBulk(
        result(2, 0),
        { one: "product", many: "products" },
        "activated"
      )
    ).toMatchObject({ title: "2 products activated", type: "success" })
    expect(
      summarizeBulk(
        result(1, 2),
        { one: "product", many: "products" },
        "activated"
      )
    ).toMatchObject({
      title: "1 product activated, 2 failed",
      description: "Not found.",
      type: "warning",
    })
    expect(
      summarizeBulk(
        result(0, 1),
        { one: "product", many: "products" },
        "activated"
      )
    ).toMatchObject({ title: "No products activated", type: "error" })
  })
})
