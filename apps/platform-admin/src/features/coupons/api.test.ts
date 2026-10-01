import { afterEach, describe, expect, it, vi } from "vitest"

import { couponState, discountText, type Coupon } from "./api"

const base: Coupon = {
  id: 1,
  code: "LAUNCH20",
  name: "Launch",
  description: null,
  discount_type: "percentage",
  discount_value: "20.0000",
  currency_code: null,
  duration: "once",
  duration_cycles: null,
  max_discount_amount: null,
  min_amount: null,
  first_subscription_only: false,
  usage_limit_total: null,
  usage_limit_per_tenant: 1,
  times_redeemed: 0,
  starts_at: null,
  ends_at: null,
  affiliate_id: null,
  is_active: true,
  created_at: null,
}

const money = (amount: string, currency: string | null) => `${currency ?? ""} ${Number(amount).toFixed(2)}`.trim()

describe("couponState", () => {
  afterEach(() => vi.useRealTimers())

  it("follows the switch, then the dates", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"))

    expect(couponState(base)).toBe("running")
    expect(couponState({ ...base, is_active: false })).toBe("inactive")
    expect(couponState({ ...base, starts_at: "2026-10-02T00:00:00Z" })).toBe("scheduled")
    expect(couponState({ ...base, ends_at: "2026-09-30T00:00:00Z" })).toBe("ended")
  })
})

describe("discountText", () => {
  it("describes the amount and how long it applies", () => {
    expect(discountText(base, money)).toBe("20% off the first payment")
    expect(discountText({ ...base, discount_type: "fixed_amount", discount_value: "5.0000", currency_code: "USD", duration: "repeating", duration_cycles: 3 }, money)).toBe(
      "USD 5.00 off for 3 payments"
    )
  })
})
