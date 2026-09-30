import "server-only"

import { z } from "zod"

/**
 * The validated server environment (spec §37). platform-web holds no
 * session, so it needs no session secret.
 */
const schema = z.object({
  APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
  ROOT_DOMAIN: z.string().min(3),
  LARAVEL_INTERNAL_URL: z.url(),
  /**
   * Where a new store's admin lives, with {slug}: "https://{slug}.admin.ROOT"
   * in production, "http://{slug}.admin.localhost:3001" locally (spec §24.3 step 6).
   */
  TENANT_ADMIN_URL: z.string().includes("{slug}"),
  PLATFORM_ADMIN_URL: z.url().optional(),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  throw new Error(`Invalid environment for platform-web:\n${z.prettifyError(parsed.error)}`)
}

export const env = parsed.data
