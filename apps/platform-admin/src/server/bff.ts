import "server-only"

import { createBff } from "@workspace/bff"

import { platformAllowList } from "@/config/bff.config"
import { env } from "@/env"

/** The platform-user BFF (spec §8). Always talks to the landlord host. */
export const platformBff = createBff({
  config: {
    kind: "landlord",
    rootDomain: env.ROOT_DOMAIN,
    laravelUrl: env.LARAVEL_INTERNAL_URL.replace(/\/$/, ""),
    sessionSecret: env.SESSION_SECRET,
    sessionSecretPrevious: env.SESSION_SECRET_PREVIOUS,
    fallbackTtlMinutes: env.SANCTUM_TTL_MINUTES,
    secureCookies: env.INSECURE_COOKIES !== "true",
  },
  actor: "platform",
  allow: platformAllowList,
  auth: {
    login: "/api/admin/auth/login",
    logout: "/api/admin/auth/logout",
    refresh: "/api/admin/auth/refresh",
    forgot: "/api/admin/auth/password/forgot",
    reset: "/api/admin/auth/password/reset",
  },
  loginPath: "/login",
})
