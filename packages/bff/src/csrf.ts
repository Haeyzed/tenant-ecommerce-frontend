/** The app's own origin as the browser sees it, from the Host the edge preserved. */
export function ownOrigin(request: Request): string | null {
  const host = request.headers.get("host")
  if (!host) return null
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "")
  return `${proto}://${host}`
}

/** Non-GET BFF requests need the app's Origin and X-Requested-With: bff (spec §8.6). */
export function passesCsrf(request: Request): boolean {
  if (request.method === "GET" || request.method === "HEAD") return true
  const origin = request.headers.get("origin")
  return origin !== null && origin === ownOrigin(request) && request.headers.get("x-requested-with") === "bff"
}
