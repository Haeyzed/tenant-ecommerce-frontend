import type { Actor, BffConfig } from "./config"

const COOKIE_NAMES: Record<Actor, string> = {
  platform: "plat",
  affiliate: "aff",
  staff: "staff",
  seller: "seller",
  customer: "cust",
}

/** `__Host-{name}` with secure cookies; the bare name on plain-http local development. */
export function cookieName(
  name: string,
  config: Pick<BffConfig, "secureCookies">
): string {
  return config.secureCookies ? `__Host-${name}` : name
}

export function sessionCookieName(
  actor: Actor,
  config: Pick<BffConfig, "secureCookies">
): string {
  return cookieName(COOKIE_NAMES[actor], config)
}

export type CookieOptions = {
  httpOnly: true
  secure: boolean
  sameSite: "lax"
  path: "/"
  maxAge?: number
  expires?: Date
}

/** HttpOnly; Secure; SameSite=Lax; Path=/; no Domain (spec §8.2). */
export function cookieOptions(
  config: Pick<BffConfig, "secureCookies">,
  expiresAt?: number
): CookieOptions {
  const options: CookieOptions = {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: "lax",
    path: "/",
  }

  if (expiresAt !== undefined) {
    options.maxAge = Math.max(0, expiresAt - Math.floor(Date.now() / 1000))
  }

  return options
}

/** Serialises a Set-Cookie header value. */
export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions
): string {
  const parts = [
    `${name}=${value}`,
    `Path=${options.path}`,
    "HttpOnly",
    "SameSite=Lax",
  ]

  if (options.secure) parts.push("Secure")
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`)
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`)

  return parts.join("; ")
}

export function clearCookie(
  name: string,
  config: Pick<BffConfig, "secureCookies">
): string {
  return serializeCookie(name, "", { ...cookieOptions(config), maxAge: 0 })
}

/** Reads one cookie from a Cookie header. */
export function readCookie(
  header: string | null,
  name: string
): string | undefined {
  if (!header) return undefined

  for (const part of header.split(";")) {
    const index = part.indexOf("=")
    if (index === -1) continue
    if (part.slice(0, index).trim() === name)
      return part.slice(index + 1).trim()
  }

  return undefined
}
