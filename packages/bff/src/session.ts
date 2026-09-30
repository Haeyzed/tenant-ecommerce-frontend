import { CompactEncrypt, compactDecrypt } from "jose"

import type { Actor, BffConfig } from "./config"

/** The sealed cookie contents (spec §8.2). Never sent to browser code. */
export type SealedSession = {
  v: 1
  actor: Actor
  token: string
  apiHost: string
  issuedAt: number
  expiresAt: number
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function key(secret: string): Uint8Array {
  const bytes = Buffer.from(secret, "base64")

  if (bytes.length !== 32) {
    throw new Error("SESSION_SECRET must be 32 bytes, base64-encoded.")
  }

  return new Uint8Array(bytes)
}

export async function sealSession(session: SealedSession, config: Pick<BffConfig, "sessionSecret">): Promise<string> {
  return new CompactEncrypt(encoder.encode(JSON.stringify(session)))
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(key(config.sessionSecret))
}

function isSession(value: unknown): value is SealedSession {
  if (typeof value !== "object" || value === null) return false
  const s = value as Record<string, unknown>

  return (
    s.v === 1 &&
    typeof s.actor === "string" &&
    typeof s.token === "string" &&
    typeof s.apiHost === "string" &&
    typeof s.issuedAt === "number" &&
    typeof s.expiresAt === "number"
  )
}

/** Decrypts with the current key, then the previous one; null for anything invalid. */
export async function unsealSession(
  sealed: string | undefined,
  config: Pick<BffConfig, "sessionSecret" | "sessionSecretPrevious">,
): Promise<SealedSession | null> {
  if (!sealed) return null

  for (const secret of [config.sessionSecret, config.sessionSecretPrevious]) {
    if (!secret) continue

    try {
      const { plaintext } = await compactDecrypt(sealed, key(secret))
      const parsed: unknown = JSON.parse(decoder.decode(plaintext))
      return isSession(parsed) ? parsed : null
    } catch {
      // Wrong key or tampered cookie: try the next key.
    }
  }

  return null
}

/**
 * A session is usable only for the host it was issued for, for its actor,
 * and before it expires (spec §7.5).
 */
export function isSessionValid(session: SealedSession | null, actor: Actor, apiHost: string, now = Date.now()): session is SealedSession {
  return session !== null && session.actor === actor && session.apiHost === apiHost && session.expiresAt * 1000 > now
}

/** Builds a session from a login or refresh response. */
export function sessionFromLogin(
  actor: Actor,
  apiHost: string,
  data: { token: string; expires_at?: string | null },
  config: Pick<BffConfig, "fallbackTtlMinutes">,
): SealedSession {
  const issuedAt = Math.floor(Date.now() / 1000)
  const parsed = data.expires_at ? Math.floor(Date.parse(data.expires_at) / 1000) : Number.NaN
  const expiresAt = Number.isFinite(parsed) ? parsed : issuedAt + config.fallbackTtlMinutes * 60

  return { v: 1, actor, token: data.token, apiHost, issuedAt, expiresAt }
}
