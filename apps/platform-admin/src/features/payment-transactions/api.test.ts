import { describe, expect, it } from "vitest"

import { lineItems, type Transaction } from "./api"

const tx = (items: Transaction["line_items"]): Transaction => ({
  id: 1,
  tenant_id: "t1",
  subscription_id: 1,
  type: "charge",
  mode: "test",
  provider: "paystack",
  reference: "REF",
  provider_reference: null,
  amount: "20.0000",
  currency_code: "USD",
  status: "successful",
  refund_of_payment_transaction_id: null,
  is_first_paid_charge: true,
  line_items: items,
  fee: null,
  failure_reason: null,
  reason: null,
  paid_at: null,
  created_at: null,
})

describe("lineItems", () => {
  it("keeps well-formed lines and normalises amounts to strings", () => {
    expect(
      lineItems(
        tx([
          { type: "plan", label: "Basic", amount: "20.0000" },
          { type: "coupon_discount", label: "LAUNCH20", amount: -4 },
          { label: "No amount" },
        ])
      )
    ).toEqual([
      { type: "plan", label: "Basic", amount: "20.0000" },
      { type: "coupon_discount", label: "LAUNCH20", amount: "-4" },
    ])
  })
})
