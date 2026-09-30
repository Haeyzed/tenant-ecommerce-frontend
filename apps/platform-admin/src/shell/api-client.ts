import { createLandlordClient } from "@workspace/api-client"

/** The browser client: every call goes to the same-origin platform BFF (spec §8.1). */
export const api = createLandlordClient({ baseUrl: "/bff/api", browser: true })
