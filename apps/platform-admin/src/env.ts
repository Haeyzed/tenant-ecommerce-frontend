import "server-only"

import { z } from "zod"

const secret = (name: string) =>
  z.string().refine((v) => Buffer.from(v, "base64").length === 32, `${name} must be 32 bytes, base64.`)

/**
 * The validated server environment (spec §37). The app refuses to start
 * with a missing or invalid value; nothing else reads process.env.
 */
const schema = z.object({
  APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
  ROOT_DOMAIN: z.string().min(3),
  LARAVEL_INTERNAL_URL: z.url(),
  SESSION_SECRET: secret("SESSION_SECRET"),
  SESSION_SECRET_PREVIOUS: secret("SESSION_SECRET_PREVIOUS").optional(),
  SANCTUM_TTL_MINUTES: z.coerce.number().int().positive().default(720),
  /** Plain-http local development only; production always uses __Host- cookies. */
  INSECURE_COOKIES: z.enum(["true", "false"]).default("false"),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  throw new Error(`Invalid environment for platform-admin:\n${z.prettifyError(parsed.error)}`)
}

if (parsed.data.APP_ENV === "production" && parsed.data.INSECURE_COOKIES === "true") {
  throw new Error("INSECURE_COOKIES is a local-development setting and is refused in production.")
}

export const env = parsed.data
