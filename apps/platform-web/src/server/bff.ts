import "server-only"

import { createPublicProxy } from "@workspace/bff"

import { publicAllowList } from "@/config/bff.config"
import { env } from "@/env"

/** The website's sessionless proxy to the landlord API (spec §8.5, §24.2). */
export const publicBff = createPublicProxy({
  config: {
    kind: "landlord",
    rootDomain: env.ROOT_DOMAIN,
    laravelUrl: env.LARAVEL_INTERNAL_URL.replace(/\/$/, ""),
    // Unused without sessions; the config type is shared with session apps.
    sessionSecret: "",
    fallbackTtlMinutes: 0,
    secureCookies: true,
  },
  allow: publicAllowList,
})
