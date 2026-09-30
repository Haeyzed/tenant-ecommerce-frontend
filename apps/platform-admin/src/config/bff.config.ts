import type { AllowRule } from "@workspace/bff"

const ALL = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const

/**
 * What the platform BFF may forward (spec §8.5, §6.3): landlord admin
 * routes except the auth routes handled by /bff/auth, plus lookups and the
 * public platform config (logo and favicon URLs for the settings screen).
 */
export const platformAllowList: readonly AllowRule[] = [
  {
    methods: ALL,
    prefix: "/api/admin/",
    except: [
      "/api/admin/auth/login",
      "/api/admin/auth/password/forgot",
      "/api/admin/auth/password/reset",
      "/api/admin/auth/logout",
      "/api/admin/auth/refresh",
    ],
  },
  { methods: ["GET"], prefix: "/api/lookups/" },
  { methods: ["GET"], prefix: "/api/platform/config" },
  { methods: ["POST"], prefix: "/api/broadcasting/auth" },
]
