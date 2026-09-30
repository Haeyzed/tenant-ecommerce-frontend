import { NextResponse, type NextRequest } from "next/server"

import { env } from "@/env"

/** Pages reachable without a platform session (invitations use the reset link). */
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/verify-email"]

const sessionCookie = env.INSECURE_COOKIES === "true" ? "plat" : "__Host-plat"

/**
 * Baseline security headers and the optimistic login redirect (spec §31.6).
 * platform-admin always talks to the landlord host, so there is no tenant
 * host to validate here. No data fetching: real checks are in the BFF and
 * Laravel.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const isPublic =
    pathname.startsWith("/bff/") ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  if (!isPublic && !request.cookies.has(sessionCookie)) {
    const login = request.nextUrl.clone()
    login.pathname = "/login"
    login.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`
    return NextResponse.redirect(login)
  }

  const response = NextResponse.next()
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
}
