import { describe, expect, it } from "vitest"

import { allowedAffiliateActions, allowedCommissionActions, allowedPayoutActions } from "./api"
import { detailLabel, textOf, INELIGIBLE_REASON } from "./labels"

describe("allowedAffiliateActions", () => {
  it("mirrors the service's transitions", () => {
    expect(allowedAffiliateActions("pending")).toEqual(["approve", "reject"])
    expect(allowedAffiliateActions("approved")).toEqual(["suspend", "close"])
    expect(allowedAffiliateActions("suspended")).toEqual(["reinstate", "close"])
    expect(allowedAffiliateActions("rejected")).toEqual([])
    expect(allowedAffiliateActions("closed")).toEqual([])
  })
})

describe("allowedCommissionActions", () => {
  it("offers approval only while pending, and nothing on clawbacks or settled rows", () => {
    expect(allowedCommissionActions({ status: "pending", type: "commission" })).toEqual(["approve", "reject", "reverse"])
    expect(allowedCommissionActions({ status: "approved", type: "commission" })).toEqual(["reject", "reverse"])
    expect(allowedCommissionActions({ status: "paid", type: "commission" })).toEqual([])
    expect(allowedCommissionActions({ status: "approved", type: "clawback" })).toEqual([])
  })
})

describe("allowedPayoutActions", () => {
  it("lets a paid payout only be failed", () => {
    expect(allowedPayoutActions("pending")).toEqual(["mark-paid", "mark-failed", "cancel"])
    expect(allowedPayoutActions("paid")).toEqual(["mark-failed"])
    expect(allowedPayoutActions("cancelled")).toEqual([])
  })
})

describe("labels", () => {
  it("names payout detail keys and falls back to readable text", () => {
    expect(detailLabel("paypal_email")).toBe("PayPal email")
    expect(detailLabel("sort_code")).toBe("Sort code")
    expect(textOf(INELIGIBLE_REASON, "self_referral")).toBe("Referred their own store")
    expect(textOf(INELIGIBLE_REASON, null)).toBe("—")
  })
})
