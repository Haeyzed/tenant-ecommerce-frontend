import { describe, expect, it } from "vitest"

import { normalizeMe } from "./me"

describe("normalizeMe", () => {
  it("normalises the staff profile and drops unknown module states", () => {
    const session = normalizeMe({
      tenant: { id: "t1", slug: "demo", primary_domain: null },
      user: {
        id: 3,
        name: "Ada",
        email: "ada@x.test",
        phone: null,
        preferences: { date_format: null, time_format: "12h" },
        last_login_at: null,
      },
      roles: ["owner"],
      permissions: ["products.view", 42],
      is_owner: true,
      modules: { hr: "enabled", pos: "weird", support: "locked" },
      display: {
        date_format: "DD/MM/YYYY",
        time_format: "12h",
        timezone: "Africa/Lagos",
      },
      payment_mode: "live",
      tenant_status: "active",
      subscription_status: "past_due",
      pending_legal_documents: [
        { id: 1, document_type: "terms", version: "2", title: "Terms" },
      ],
    })

    expect(session.permissions).toEqual(["products.view"])
    expect(session.modules).toEqual({ hr: "enabled", support: "locked" })
    expect(session.paymentMode).toBe("live")
    expect(session.subscriptionStatus).toBe("past_due")
    expect(session.pendingLegalDocuments).toHaveLength(1)
  })

  it("treats owner-only fields as absent for other staff and never throws on junk", () => {
    const session = normalizeMe({ user: {}, roles: "nope", modules: null })

    expect(session.isOwner).toBe(false)
    expect(session.tenantStatus).toBeNull()
    expect(session.roles).toEqual([])
    expect(session.display.timezone).toBe("UTC")
    expect(session.paymentMode).toBe("test")
  })
})
