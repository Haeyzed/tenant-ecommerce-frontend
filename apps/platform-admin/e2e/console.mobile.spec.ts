import { expect, test } from "@playwright/test"

import { trackPageErrors } from "./helpers"

/** Every console page renders at phone width without horizontal scrolling. */
const PAGES = [
  "/dashboard",
  "/tenant-registrations",
  "/tenants",
  "/database-servers",
  "/plans",
  "/plans/new",
  "/subscriptions",
  "/payment-transactions",
  "/platform-commissions",
  "/platform-coupons",
  "/platform-coupons/new",
  "/payment-gateways",
  "/legal-documents",
  "/legal-documents/new",
  "/platform-users",
  "/notifications",
  "/notifications?tab=channels",
  "/platform-settings",
]

for (const path of PAGES) {
  test(`${path} fits a phone screen`, async ({ page }) => {
    const errors = trackPageErrors(page)
    await page.goto(path)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    expect(errors).toEqual([])
  })
}
