import "server-only"

import { createBff } from "@workspace/bff"

import { staffAllowList } from "@/config/bff.config"
import { env } from "@/env"

/** The staff BFF (spec §8). One instance per server process. */
export const staffBff = createBff({
  config: {
    kind: "tenant-admin",
    rootDomain: env.ROOT_DOMAIN,
    laravelUrl: env.LARAVEL_INTERNAL_URL.replace(/\/$/, ""),
    sessionSecret: env.SESSION_SECRET,
    sessionSecretPrevious: env.SESSION_SECRET_PREVIOUS,
    fallbackTtlMinutes: env.SANCTUM_TTL_MINUTES,
    secureCookies: env.INSECURE_COOKIES !== "true",
    devTenantSlug: env.APP_ENV === "local" ? env.DEV_TENANT_SLUG : undefined,
    devAdminHost: env.APP_ENV === "local" ? env.DEV_ADMIN_HOST : undefined,
  },
  actor: "staff",
  allow: staffAllowList,
  auth: {
    login: "/api/admin/auth/login",
    logout: "/api/admin/auth/logout",
    refresh: "/api/admin/auth/refresh",
    forgot: "/api/admin/auth/password/forgot",
    reset: "/api/admin/auth/password/reset",
  },
  loginPath: "/login",
})
