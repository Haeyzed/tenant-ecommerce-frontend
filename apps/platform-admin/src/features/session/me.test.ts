import { describe, expect, it } from "vitest"

import { normalizeMe, toAccessSnapshot } from "./me"

describe("normalizeMe", () => {
  it("reads the landlord profile", () => {
    const session = normalizeMe({
      user: { id: 2, name: "QA Admin", email: "qa-admin@platform.test" },
      roles: ["super-admin"],
      permissions: ["tenants.view", 3],
      display: { date_format: "DD/MM/YYYY", time_format: "12h", timezone: "Africa/Lagos" },
    })

    expect(session.user).toEqual({ id: 2, name: "QA Admin", email: "qa-admin@platform.test" })
    expect(session.permissions).toEqual(["tenants.view"])
    expect(session.display.timezone).toBe("Africa/Lagos")
    expect(toAccessSnapshot(session).isOwner).toBe(true)
  })

  it("falls back safely on a malformed payload", () => {
    const session = normalizeMe(null)
    expect(session.user.id).toBe(0)
    expect(session.roles).toEqual([])
    expect(session.display).toEqual({ date_format: "YYYY-MM-DD", time_format: "24h", timezone: "UTC" })
  })
})
