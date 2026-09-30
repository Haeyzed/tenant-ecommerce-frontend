import { describe, expect, it } from "vitest"

import { navRoutes } from "@workspace/admin-kit/nav"
import { tenantRoutes } from "@workspace/contract/routes/tenant"

import { navEntries, navGroups } from "./nav"

describe("tenant-admin navigation registry", () => {
  it("references only Laravel routes in the generated manifest (spec §17.2 rule 1)", () => {
    const missing = navRoutes(navEntries).filter(
      (route) => !(route in tenantRoutes)
    )
    expect(missing).toEqual([])
  })

  it("places every entry in a declared group", () => {
    const groups = new Set(navGroups.map((g) => g.id))
    expect(
      navEntries.filter((e) => !groups.has(e.group)).map((e) => e.id)
    ).toEqual([])
  })
})
