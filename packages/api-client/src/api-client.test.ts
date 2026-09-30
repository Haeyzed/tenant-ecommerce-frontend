import { describe, expect, it } from "vitest"

import { ApiError, isLimitError, isRetryable, isValidation } from "./errors"
import { serializeQuery } from "./query"
import { unwrap, unwrapPage } from "./unwrap"

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } })

describe("serializeQuery", () => {
  it("uses Laravel bracket notation and drops empty values", () => {
    const query = serializeQuery({
      status: ["paid", "shipped"],
      cf: { colour: "red", weight: { from: 1 } },
      search: "",
      active: true,
      page: 2,
      missing: undefined,
    })

    expect(decodeURIComponent(query)).toBe("status[]=paid&status[]=shipped&cf[colour]=red&cf[weight][from]=1&active=1&page=2")
  })
})

describe("ApiError.fromResponse", () => {
  it("reads the envelope code, details, field errors and headers", () => {
    const response = json(
      422,
      { success: false, message: "The given data was invalid.", data: null, meta: { error_code: "validation_failed", details: {} }, errors: { email: ["Taken."] } },
      { "X-Request-Id": "req-1" },
    )
    const error = ApiError.fromResponse(response, { success: false, message: "The given data was invalid.", meta: { error_code: "validation_failed", details: {} }, errors: { email: ["Taken."] } })

    expect(error.code).toBe("validation_failed")
    expect(error.fieldErrors).toEqual({ email: ["Taken."] })
    expect(error.requestId).toBe("req-1")
    expect(isValidation(error)).toBe(true)
  })

  it("maps a non-envelope 5xx to upstream_unavailable and keeps Retry-After", () => {
    const error = ApiError.fromResponse(new Response("<html>", { status: 503, headers: { "Retry-After": "30" } }), "<html>")

    expect(error.code).toBe("upstream_unavailable")
    expect(error.retryAfter).toBe(30)
    expect(isRetryable(error)).toBe(true)
  })

  it("recognises limit errors and does not retry maintenance", () => {
    const limit = new ApiError({ status: 403, code: "limit_reached", message: "Limit" })
    const maintenance = new ApiError({ status: 503, code: "maintenance", message: "Down" })

    expect(isLimitError(limit)).toBe(true)
    expect(isRetryable(maintenance)).toBe(false)
  })
})

describe("unwrap", () => {
  it("returns the envelope data", async () => {
    const response = json(200, { success: true, message: "OK", data: { id: 1 }, meta: {}, errors: {} })
    const data = await unwrap(Promise.resolve({ data: { success: true, message: "OK", data: { id: 1 }, meta: {}, errors: {} }, response }))

    expect(data).toEqual({ id: 1 })
  })

  it("throws ApiError for an error body", async () => {
    const body = { success: false, message: "Nope", data: null, meta: { error_code: "forbidden", details: {} }, errors: {} }

    await expect(unwrap(Promise.resolve({ error: body, response: json(403, body) }))).rejects.toMatchObject({ status: 403, code: "forbidden" })
  })

  it("turns a rejected fetch into a network error", async () => {
    await expect(unwrap(Promise.reject(new TypeError("fetch failed")))).rejects.toMatchObject({ status: 0, code: "network_error" })
  })

  it("splits a paginated envelope into items and pagination", async () => {
    const body = {
      success: true,
      message: "OK",
      data: [{ id: 1 }],
      meta: { pagination: { current_page: 1, per_page: 25, from: 1, to: 1, total: 1, last_page: 1 }, links: {}, unread_count: 3 },
      errors: {},
    }
    const page = await unwrapPage(Promise.resolve({ data: body, response: json(200, body) }))

    expect(page.items).toEqual([{ id: 1 }])
    expect(page.pagination.total).toBe(1)
    expect(page.meta).toEqual({ unread_count: 3 })
  })
})
