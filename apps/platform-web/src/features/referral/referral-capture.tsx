"use client"

import { useEffect } from "react"

/**
 * On a landing URL with `?ref=CODE`, records the click through the BFF,
 * which keeps the token in an HttpOnly cookie, then removes `ref` from the
 * address bar (spec §24.4). If recording fails, `ref` stays in the URL so
 * the pricing and signup pages can still pass the code on.
 */
export function ReferralCapture() {
  useEffect(() => {
    const url = new URL(window.location.href)
    const code = url.searchParams.get("ref")?.trim()
    if (!code) return

    const controller = new AbortController()
    const body = {
      code,
      landing_path: url.pathname,
      referrer: document.referrer || null,
      utm_source: url.searchParams.get("utm_source"),
      utm_medium: url.searchParams.get("utm_medium"),
      utm_campaign: url.searchParams.get("utm_campaign"),
    }

    fetch("/bff/affiliate-clicks", {
      method: "POST",
      headers: { "content-type": "application/json", "x-requested-with": "bff" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) return
        url.searchParams.delete("ref")
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`)
      })
      .catch(() => undefined)

    return () => controller.abort()
  }, [])

  return null
}
