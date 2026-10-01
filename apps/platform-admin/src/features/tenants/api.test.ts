import { describe, expect, it } from "vitest"

import { allowedActions, type Tenant } from "./api"

const tenant = (status: string, provisioned = true): Tenant => ({
  id: "t1",
  name: "Demo",
  slug: "demo",
  owner_name: "Owner",
  email: "owner@demo.test",
  status,
  status_reason: null,
  country_id: 1,
  default_currency: "USD",
  timezone: "UTC",
  database_server_id: null,
  permissions_version: null,
  schema_version: null,
  provisioned_at: provisioned ? "2026-09-30T00:00:00Z" : null,
  suspended_at: null,
  closed_at: null,
  purge_after: null,
  purged_at: null,
  trial_consumed_at: null,
  created_at: null,
})

/** Mirrors TenantManagementService's allowed transitions. */
describe("allowedActions", () => {
  it("follows the tenant lifecycle", () => {
    expect(allowedActions(tenant("active"))).toEqual(["suspend", "close", "export"])
    expect(allowedActions(tenant("suspended"))).toEqual(["reactivate", "close", "export"])
    expect(allowedActions(tenant("closed"))).toEqual(["restore", "export"])
    expect(allowedActions(tenant("awaiting_payment", false))).toEqual(["close"])
    expect(allowedActions(tenant("provisioning_failed", false))).toEqual(["close"])
    expect(allowedActions(tenant("provisioning", false))).toEqual([])
    expect(allowedActions(tenant("purged"))).toEqual([])
  })

  it("never offers restore or export for a store that was never set up", () => {
    expect(allowedActions(tenant("closed", false))).toEqual([])
    expect(allowedActions(tenant("active", false))).toEqual(["suspend", "close"])
  })
})
