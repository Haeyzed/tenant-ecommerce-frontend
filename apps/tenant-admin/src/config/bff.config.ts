import type { AllowRule } from "@workspace/bff"

const ALL = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const

/**
 * What the staff BFF may forward (spec §8.5, §6.3). Auth login and password
 * routes go through /bff/auth only; landlord hosts are never reachable.
 */
export const staffAllowList: readonly AllowRule[] = [
  {
    methods: ALL,
    prefix: "/api/admin/",
    except: [
      "/api/admin/auth/login",
      "/api/admin/auth/password/",
      "/api/admin/auth/logout",
      "/api/admin/auth/refresh",
    ],
  },
  { methods: ["GET"], prefix: "/api/module-notices" },
  { methods: ["GET"], prefix: "/api/lookups/" },
  { methods: ["POST"], prefix: "/api/broadcasting/auth" },
]
