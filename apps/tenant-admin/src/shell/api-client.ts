import { createTenantClient } from "@workspace/api-client"

/**
 * The browser API client: every call goes to the same-origin staff BFF,
 * which attaches the session and forwards to Laravel (spec §8.1, §12.2).
 */
export const api = createTenantClient({
  baseUrl: "/bff/staff/api",
  browser: true,
})
