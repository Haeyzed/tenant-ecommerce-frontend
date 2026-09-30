import { expect, test } from "@playwright/test"

import { trackPageErrors } from "./helpers"

/** The platform dashboard's date range (spec §22.1). */
test("presets, custom ranges and comparison reach the API and show their dates", async ({ page }) => {
  const errors = trackPageErrors(page)
  await page.goto("/dashboard")

  // The resolved dates are shown, so "Last 30 days" ending yesterday is visible.
  const resolved = page.getByText(/^Showing .+, compared with .+\.$/)
  await expect(resolved).toBeVisible()

  const picker = page.getByRole("button", { name: "Date range" })
  await picker.click()
  await page.getByRole("button", { name: "This month" }).click()
  await expect(page).toHaveURL(/range=this_month/)
  await expect(resolved).toBeVisible()

  // A custom range: the 1st to the 10th of last month (always in the past).
  const lastMonth = new Date()
  lastMonth.setDate(1)
  lastMonth.setMonth(lastMonth.getMonth() - 1)
  const month = lastMonth.toLocaleString("en-US", { month: "long" })
  const year = lastMonth.getFullYear()
  await picker.click()
  await page.getByRole("button", { name: new RegExp(`${month} 1st, ${year}`) }).click()
  await page.getByRole("button", { name: new RegExp(`${month} 10th, ${year}`) }).click()
  await page.getByRole("button", { name: "Apply" }).click()

  const mm = String(lastMonth.getMonth() + 1).padStart(2, "0")
  await expect(page).toHaveURL(new RegExp(`range=custom.*from=${year}-${mm}-01.*to=${year}-${mm}-10`))
  await expect(page.getByText(new RegExp(`^Showing .*${year}.*, compared with`))).toBeVisible()

  // No comparison: the sentence loses its "compared with" part.
  await page.getByRole("combobox", { name: "Comparison" }).click()
  await page.getByRole("option", { name: "No comparison" }).click()
  await expect(page).toHaveURL(/compare=none/)
  await expect(page.getByText(/^Showing [^,]+\.$/)).toBeVisible()

  expect(errors).toEqual([])
})

test("test-mode billing explains why money figures exclude test data", async ({ page }) => {
  await page.goto("/payment-gateways")
  const testBilling = await page.getByText("Test billing").isVisible()
  await page.goto("/dashboard")
  const notice = page.getByText("Billing is in test mode")
  if (testBilling) await expect(notice).toBeVisible()
  else await expect(notice).toHaveCount(0)
})
