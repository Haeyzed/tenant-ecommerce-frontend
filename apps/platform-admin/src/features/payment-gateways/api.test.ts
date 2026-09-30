import { afterEach, describe, expect, it, vi } from "vitest"

import { isFreshlyVerified, normalizeGateway, type Gateway } from "./api"

const raw = {
  provider: "paystack",
  mode: "test",
  configured: true,
  public_key: "pk_test_…1234",
  // The generator types these as strings; the API sends booleans.
  has_secret_key: "1",
  has_webhook_secret: "",
  is_enabled: false,
  is_default: false,
  sort_order: 0,
  supported_currencies: ["NGN"],
  supported_country_ids: null,
  credentials_verified_at: null,
  last_webhook_at: null,
  webhook_url: "http://tenant-ecommerce-api.test/api/webhooks/paystack/test",
}

describe("normalizeGateway", () => {
  it("maps the API row", () => {
    expect(normalizeGateway(raw)).toMatchObject({ provider: "paystack", mode: "test", hasSecretKey: true, hasWebhookSecret: false, countryIds: null })
  })

  it("drops unknown providers and modes", () => {
    expect(normalizeGateway({ ...raw, provider: "paypal" })).toBeNull()
    expect(normalizeGateway({ ...raw, mode: "sandbox" })).toBeNull()
  })
})

describe("isFreshlyVerified", () => {
  afterEach(() => vi.useRealTimers())

  const base = normalizeGateway(raw)
  const at = (verifiedAt: string | null): Gateway => {
    if (base === null) throw new Error("fixture must normalise")
    return { ...base, verifiedAt }
  }

  it("allows enabling for 24 hours after a successful test", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"))
    expect(isFreshlyVerified(at("2026-09-30T00:00:00Z"))).toBe(true)
    expect(isFreshlyVerified(at("2026-09-29T11:00:00Z"))).toBe(false)
    expect(isFreshlyVerified(at(null))).toBe(false)
  })
})
