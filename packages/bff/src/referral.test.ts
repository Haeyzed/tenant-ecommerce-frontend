import { describe, expect, it } from "vitest"

import { decodeReferral, encodeReferral, withReferralToken } from "./referral"

const referral = { token: "eyJjIjoxfQ.sig", visitorId: "6f1c2b0e-0000-4000-8000-000000000001" }

function post(path: string, body: string) {
  return new Request(`https://platform.test/bff/api/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body })
}

describe("referral cookie", () => {
  it("round-trips the token and visitor id", () => {
    expect(decodeReferral(encodeReferral(referral))).toEqual(referral)
  })

  it("rejects missing, malformed or incomplete values", () => {
    expect(decodeReferral(undefined)).toBeNull()
    expect(decodeReferral("not-base64-json")).toBeNull()
    expect(decodeReferral(Buffer.from(JSON.stringify({ t: "", v: "x" })).toString("base64url"))).toBeNull()
    expect(decodeReferral(Buffer.from(JSON.stringify({ t: 1, v: "x" })).toString("base64url"))).toBeNull()
  })
})

describe("withReferralToken", () => {
  it("adds the token to the registration body", async () => {
    const request = await withReferralToken(post("register", JSON.stringify({ email: "a@b.test", ref: "ADA" })), ["register"], referral)
    expect(await request.json()).toEqual({ email: "a@b.test", ref: "ADA", referral_token: referral.token })
  })

  it("leaves other routes, missing referrals and non-object bodies alone", async () => {
    const verify = post("register/verify", "{}")
    expect(await withReferralToken(verify, ["register", "verify"], referral)).toBe(verify)

    const noReferral = post("register", "{}")
    expect(await withReferralToken(noReferral, ["register"], null)).toBe(noReferral)

    const array = post("register", "[1]")
    expect(await withReferralToken(array, ["register"], referral)).toBe(array)
  })
})
