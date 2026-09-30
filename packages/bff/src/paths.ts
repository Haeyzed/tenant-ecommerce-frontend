import type { AllowRule, HttpMethod } from "./config"

/**
 * Normalises a BFF path and rejects traversal and encoding tricks (spec §8.5):
 * `..` or `.` segments, encoded slashes or backslashes, double slashes and
 * control characters. Returns the upstream path ("/api/...") or null.
 */
export function normalizeUpstreamPath(segments: readonly string[]): string | null {
  if (segments.length === 0) return null

  for (const segment of segments) {
    if (segment === "" || segment === "." || segment === "..") return null
    if (/%2f|%5c|%2e/i.test(segment)) return null
    if (/[\\/\u0000-\u001f]/.test(segment)) return null
  }

  return `/api/${segments.join("/")}`
}

export function isAllowed(rules: readonly AllowRule[], method: string, path: string): boolean {
  const upper = method.toUpperCase() as HttpMethod

  return rules.some(
    (rule) =>
      rule.methods.includes(upper) &&
      (path === rule.prefix.replace(/\/$/, "") || path.startsWith(rule.prefix)) &&
      !(rule.except ?? []).some((blocked) => path === blocked.replace(/\/$/, "") || path.startsWith(blocked)),
  )
}

/** Validates a post-login `next` target: a same-origin relative path only (spec §9.2). */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback
  if (/[\u0000-\u001f]/.test(next)) return fallback
  return next
}
