import { NextResponse, type NextRequest } from "next/server"

import { resolveTenantContext } from "@workspace/bff/tenant"

import { env } from "@/env"

/** Pages reachable without a staff session. */
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"]

const staffCookie = env.INSECURE_COOKIES === "true" ? "staff" : "__Host-staff"

/**
 * Host validation, baseline security headers and the optimistic login
 * redirect (spec §31.6). No data fetching: real checks happen in the BFF
 * and in Laravel.
 */
export function proxy(request: NextRequest) {
  const tenant = resolveTenantContext(request.headers.get("host"), {
    kind: "tenant-admin",
    rootDomain: env.ROOT_DOMAIN,
    devTenantSlug: env.APP_ENV === "local" ? env.DEV_TENANT_SLUG : undefined,
    devAdminHost: env.APP_ENV === "local" ? env.DEV_ADMIN_HOST : undefined,
  })

  if (tenant === null) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    })
  }

  const { pathname, search } = request.nextUrl
  const isPublic =
    pathname.startsWith("/bff/") ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  if (!isPublic && !request.cookies.has(staffCookie)) {
    const login = request.nextUrl.clone()
    login.pathname = "/login"
    login.search =
      pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`
    return NextResponse.redirect(login)
  }

  const response = NextResponse.next()
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=()"
  )
  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
}
