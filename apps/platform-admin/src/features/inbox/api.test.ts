import { describe, expect, it } from "vitest"

import { unreadLabel } from "@workspace/admin-kit/shell"

import { inboxHref, markLocally, unreadCountOf, type Inbox, type InboxItem } from "./api"

function item(id: string, read: boolean): InboxItem {
  return { id, key: "platform.onboarding_paused", subject: "S", body: "B", data: {}, source: "store", read_at: read ? "2026-10-01T10:00:00Z" : null, created_at: "2026-10-01T09:00:00Z" }
}

describe("unreadCountOf", () => {
  it("reads meta.unread_count and ignores anything else", () => {
    expect(unreadCountOf({ meta: { unread_count: 3 } })).toBe(3)
    expect(unreadCountOf({ meta: { unread_count: "3" } })).toBe(0)
    expect(unreadCountOf({ meta: {} })).toBe(0)
  })
})

describe("markLocally", () => {
  const inbox: Inbox = { items: [item("a", false), item("b", false), item("c", true)], unreadCount: 7 }

  it("marks one item and lowers the count by one", () => {
    const next = markLocally(inbox, new Set(["a"]))
    expect(next?.items.map((i) => Boolean(i.read_at))).toEqual([true, false, true])
    expect(next?.unreadCount).toBe(6)
  })

  it("doesn't lower the count for an item already read", () => {
    expect(markLocally(inbox, new Set(["c"]))?.unreadCount).toBe(7)
  })

  it("marks everything, including unread items beyond the first page", () => {
    const next = markLocally(inbox, "all")
    expect(next?.items.every((i) => i.read_at)).toBe(true)
    expect(next?.unreadCount).toBe(0)
  })
})

describe("bell", () => {
  it("caps the badge at 99+", () => {
    expect(unreadLabel(5)).toBe("5")
    expect(unreadLabel(100)).toBe("99+")
  })

  it("links only to screens that exist", () => {
    expect(inboxHref({ key: "platform.onboarding_paused", data: {} })).toBe("/platform-settings")
    expect(inboxHref({ key: "platform.export_ready", data: { export_id: 3 } })).toBeNull()
  })

  it("opens the affiliate an application came from", () => {
    expect(inboxHref({ key: "affiliate.application_submitted", data: { affiliate_id: 12 } })).toBe("/affiliates/12")
    expect(inboxHref({ key: "affiliate.application_submitted", data: { affiliate_id: "x" } })).toBe("/affiliates?status=pending")
    expect(inboxHref({ key: "affiliate.referral_flagged", data: {} })).toBe("/affiliate-referrals?review=true")
  })
})
