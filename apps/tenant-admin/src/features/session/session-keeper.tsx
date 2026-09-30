"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

type SessionStatus = {
  authenticated: boolean
  expiresAt: number | null
  issuedAt: number | null
}

const IDLE_LIMIT_MS = 30 * 60_000
const SNAPSHOT_INTERVAL_MS = 5 * 60_000

async function readSession(): Promise<SessionStatus | null> {
  try {
    const response = await fetch("/bff/session", { cache: "no-store" })
    return response.ok ? ((await response.json()) as SessionStatus) : null
  } catch {
    return null
  }
}

/**
 * Keeps the staff session alive while the user works (spec §9.3): refreshes
 * at 75% of the token lifetime, in one tab only, and stops after 30 idle
 * minutes so an abandoned session expires. Also logs out other tabs and
 * refreshes the access snapshot on focus (spec §10.2).
 */
export function SessionKeeper() {
  const router = useRouter()
  const lastActivity = useRef(0)
  const lastSnapshot = useRef(0)

  useEffect(() => {
    lastActivity.current = Date.now()
    lastSnapshot.current = Date.now()
    const touch = () => {
      lastActivity.current = Date.now()
    }
    const events = ["pointerdown", "keydown", "scroll"] as const
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }))

    const channel = new BroadcastChannel("session:staff")
    channel.onmessage = (event) => {
      if (event.data === "logout") window.location.assign("/login")
    }

    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false

    const schedule = async () => {
      const status = await readSession()
      if (cancelled || status === null) return
      if (!status.authenticated || status.expiresAt === null) {
        window.location.assign(
          `/bff/session/expired?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
        )
        return
      }

      const now = Date.now() / 1000
      const issued = status.issuedAt ?? now
      const refreshAt = issued + (status.expiresAt - issued) * 0.75
      timer = setTimeout(refresh, Math.max(5_000, (refreshAt - now) * 1000))
    }

    const refresh = async () => {
      if (Date.now() - lastActivity.current > IDLE_LIMIT_MS) return

      const run = async () => {
        // Another tab may have refreshed already; only refresh if still due.
        const status = await readSession()
        const now = Date.now() / 1000
        if (
          status?.authenticated &&
          status.expiresAt !== null &&
          status.issuedAt !== null
        ) {
          const due =
            status.issuedAt + (status.expiresAt - status.issuedAt) * 0.75
          if (now >= due - 5) {
            await fetch("/bff/auth/refresh", {
              method: "POST",
              headers: { "X-Requested-With": "bff" },
            }).catch(() => undefined)
          }
        }
      }

      if ("locks" in navigator)
        await navigator.locks.request("tenant-admin-session-refresh", run)
      else await run()

      if (!cancelled) void schedule()
    }

    void schedule()

    const onFocus = () => {
      if (Date.now() - lastSnapshot.current > SNAPSHOT_INTERVAL_MS) {
        lastSnapshot.current = Date.now()
        router.refresh()
      }
    }
    window.addEventListener("focus", onFocus)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, touch))
      window.removeEventListener("focus", onFocus)
      channel.close()
    }
  }, [router])

  return null
}
