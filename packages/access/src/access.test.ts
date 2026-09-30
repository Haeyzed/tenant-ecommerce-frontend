import { describe, expect, it } from "vitest"

import { tenantRoutes } from "@workspace/contract/routes/tenant"

import { canRoute, routeVisibility, type AccessSnapshot } from "./index"

const snapshot = (permissions: string[], modules: AccessSnapshot["modules"] = {}): AccessSnapshot => ({
  permissions: new Set(permissions),
  roles: [],
  modules,
  isOwner: false,
})

describe("canRoute against the generated tenant manifest", () => {
  it("checks the derived permission for core routes", () => {
    expect(canRoute(snapshot(["products.view"]), tenantRoutes, "tenant.catalog.admin.products.index")).toBe(true)
    expect(canRoute(snapshot([]), tenantRoutes, "tenant.catalog.admin.products.index")).toBe(false)
  })

  it("lets reads through while a read-when-inactive module is disabled, but not writes", () => {
    const disabled = snapshot(["hr.shifts.view", "hr.shifts.create"], { hr: "disabled" })

    expect(canRoute(disabled, tenantRoutes, "tenant.admin.hr.shifts.index")).toBe(true)
    expect(canRoute(disabled, tenantRoutes, "tenant.admin.hr.shifts.store")).toBe(false)
    expect(canRoute(snapshot(["hr.shifts.create"], { hr: "enabled" }), tenantRoutes, "tenant.admin.hr.shifts.store")).toBe(true)
  })

  it("never passes a suspended module and refuses unknown routes", () => {
    expect(canRoute(snapshot(["hr.shifts.view"], { hr: "suspended" }), tenantRoutes, "tenant.admin.hr.shifts.index")).toBe(false)
    expect(canRoute(snapshot(["products.view"]), tenantRoutes, "tenant.nope")).toBe(false)
  })

  it("keeps wind-down routes usable on a locked module", () => {
    const locked = snapshot(["pos.sessions.close"], { pos: "locked" })
    expect(canRoute(locked, tenantRoutes, "tenant.admin.pos.sessions.close")).toBe(true)
  })

  it("puts readable inactive modules into the inactive navigation group", () => {
    expect(routeVisibility(snapshot(["hr.shifts.view"], { hr: "locked" }), tenantRoutes, "tenant.admin.hr.shifts.index")).toBe("inactive")
    expect(routeVisibility(snapshot(["hr.shifts.view"], { hr: "available" }), tenantRoutes, "tenant.admin.hr.shifts.index")).toBe("hidden")
    expect(routeVisibility(snapshot([], { hr: "enabled" }), tenantRoutes, "tenant.admin.hr.shifts.index")).toBe("hidden")
  })
})
