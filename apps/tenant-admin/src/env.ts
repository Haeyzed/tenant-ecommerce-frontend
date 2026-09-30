import "server-only"

import { z } from "zod"

/**
 * The validated server environment (spec §37). The app refuses to start
 * with a missing or invalid value; nothing else reads process.env.
 */
const schema = z.object({
  APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
  ROOT_DOMAIN: z.string().min(3),
  LARAVEL_INTERNAL_URL: z.url(),
  SESSION_SECRET: z
    .string()
    .refine(
      (v) => Buffer.from(v, "base64").length === 32,
      "SESSION_SECRET must be 32 bytes, base64."
    ),
  SESSION_SECRET_PREVIOUS: z
    .string()
    .refine(
      (v) => Buffer.from(v, "base64").length === 32,
      "SESSION_SECRET_PREVIOUS must be 32 bytes, base64."
    )
    .optional(),
  SANCTUM_TTL_MINUTES: z.coerce.number().int().positive().default(720),
  /** Plain-http local development only; production always uses __Host- cookies. */
  INSECURE_COOKIES: z.enum(["true", "false"]).default("false"),
  /** Local development without the edge: the tenant served on localhost (spec §38.6). */
  DEV_TENANT_SLUG: z.string().optional(),
  /** Local development: {slug}.{DEV_ADMIN_HOST} reaches any store, e.g. "admin.localhost" (spec §38.6). */
  DEV_ADMIN_HOST: z.string().optional(),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  throw new Error(
    `Invalid environment for tenant-admin:\n${z.prettifyError(parsed.error)}`
  )
}

if (
  parsed.data.APP_ENV === "production" &&
  (parsed.data.INSECURE_COOKIES === "true" || parsed.data.DEV_TENANT_SLUG || parsed.data.DEV_ADMIN_HOST)
) {
  throw new Error(
    "INSECURE_COOKIES, DEV_TENANT_SLUG and DEV_ADMIN_HOST are local-development settings and are refused in production."
  )
}

export const env = parsed.data
