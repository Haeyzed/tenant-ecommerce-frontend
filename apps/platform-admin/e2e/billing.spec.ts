import { expect, test } from "@playwright/test"

import { trackPageErrors } from "./helpers"

/**
 * Subscriptions, transactions, commissions and coupons (spec §25.1).
 * Real records are only read: no refund (it would call the gateway) and
 * no trial extension. Coupon writes go to one dedicated coupon,
 * E2E-COUPON, created on the first run and reused (coupons can't be
 * deleted).
 */
test.describe.configure({ mode: "serial" })

const E2E_CODE = "E2E-COUPON"

test("subscriptions list names tenants, filters and opens a subscription", async ({ page }) => {
  const errors = trackPageErrors(page)
  await page.goto("/subscriptions")
  await expect(page.getByRole("heading", { level: 1, name: "Subscriptions" })).toBeVisible()

  const firstRow = page.getByRole("row").nth(1)
  await expect(firstRow).toBeVisible()
  // Tenant names, not ids.
  await expect(firstRow).not.toContainText(/^[0-9a-f]{8}-[0-9a-f]{4}/)

  await page.getByRole("combobox", { name: "Mode" }).click()
  await page.getByRole("option", { name: "Test only" }).click()
  await expect(page).toHaveURL(/mode=test/)
  await expect(page.getByRole("row").nth(1).getByText("Test", { exact: true })).toBeVisible()

  await page.getByRole("row").nth(1).getByRole("link").first().click()
  await expect(page).toHaveURL(/\/subscriptions\/\d+/)
  await expect(page.getByText("Billing", { exact: true })).toBeVisible()
  await expect(page.getByText("Recent payments")).toBeVisible()

  await page.getByRole("link", { name: "All payments" }).click()
  await expect(page).toHaveURL(/\/payment-transactions\?tenant=/)
  expect(errors).toEqual([])
})

test("a trial extension needs days and a reason", async ({ page }) => {
  await page.goto("/subscriptions?status=trialing")
  const row = page.getByRole("row").nth(1)
  test.skip((await row.textContent())?.includes("No subscriptions") ?? true, "No trialing subscription to open")
  await row.getByRole("link").first().click()

  await page.getByRole("button", { name: "Extend trial" }).click()
  const dialog = page.getByRole("dialog", { name: "Extend trial" })
  await dialog.getByLabel("Extra days").fill("400")
  await dialog.getByRole("button", { name: "Extend trial" }).click()
  await expect(dialog.getByText("Enter 1 to 365 days.")).toBeVisible()
  await expect(dialog.getByText("Give a reason. It is kept in the activity log.")).toBeVisible()

  await dialog.getByLabel("Extra days").fill("7")
  await expect(dialog.getByText(/^New end date:/)).toBeVisible()
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(dialog).toBeHidden()
})

test("transactions filter by type and a charge offers a bounded refund", async ({ page }) => {
  const errors = trackPageErrors(page)
  await page.goto("/payment-transactions?type=charge&status=successful")
  await expect(page.getByRole("heading", { level: 1, name: "Payment transactions" })).toBeVisible()

  const row = page.getByRole("row").nth(1)
  test.skip((await row.textContent())?.includes("No transactions") ?? true, "No successful charge to open")
  await row.getByRole("link").first().click()
  await expect(page).toHaveURL(/\/payment-transactions\/\d+/)
  await expect(page.getByText("References")).toBeVisible()

  const refund = page.getByRole("button", { name: "Refund" })
  if (await refund.isVisible()) {
    await refund.click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel(/^Amount/).fill("999999")
    await dialog.getByRole("button", { name: "Refund" }).click()
    await expect(dialog.getByText(/^At most .+ can be refunded\.$/)).toBeVisible()
    await expect(dialog.getByText("Give a reason. It is kept with the refund.")).toBeVisible()
    await dialog.getByRole("button", { name: "Cancel" }).click()
    await expect(dialog).toBeHidden()
  }
  expect(errors).toEqual([])
})

test("commissions list renders with its filters", async ({ page }) => {
  const errors = trackPageErrors(page)
  await page.goto("/platform-commissions")
  await expect(page.getByRole("heading", { level: 1, name: "Commissions" })).toBeVisible()
  await page.getByRole("combobox", { name: "Status" }).click()
  await page.getByRole("option", { name: "Pending" }).click()
  await expect(page).toHaveURL(/status=pending/)
  expect(errors).toEqual([])
})

test("a coupon validates, saves and shows its usage", async ({ page }) => {
  await page.goto("/platform-coupons")
  await expect(page.getByRole("heading", { level: 1, name: "Coupons" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Columns" })).toBeVisible()

  const existing = page.getByRole("row").filter({ hasText: E2E_CODE })
  if ((await existing.count()) === 0) {
    await page.getByRole("link", { name: "New coupon" }).click()
    await page.getByRole("button", { name: "Create coupon" }).click()
    await expect(page.getByText("4 to 32 letters, numbers or dashes.")).toBeVisible()
    await expect(page.getByText("Enter a discount greater than zero.")).toBeVisible()

    await page.getByLabel("Code").fill(E2E_CODE.toLowerCase())
    await page.getByLabel("Name").fill("E2E test coupon")
    await page.getByLabel("Percent off").fill("10")
    await page.getByRole("switch", { name: "Active" }).click()
    await page.getByRole("button", { name: "Create coupon" }).click()
  } else {
    await existing.first().getByRole("link").first().click()
  }

  await expect(page).toHaveURL(/\/platform-coupons\/\d+$/)
  await expect(page.getByRole("heading", { level: 1, name: E2E_CODE })).toBeVisible()
  await expect(page.getByText("10% off the first payment")).toBeVisible()
  await expect(page.getByText("Redemptions", { exact: true })).toBeVisible()

  await page.getByRole("link", { name: "Edit" }).click()
  await expect(page.getByLabel("Code")).toBeDisabled()
  const description = `Checked ${new Date().toISOString()}`
  await page.getByLabel("Description").fill(description)
  await page.getByRole("button", { name: "Save coupon" }).click()
  await expect(page).toHaveURL(/\/platform-coupons\/\d+$/)
  await expect(page.getByText(description)).toBeVisible()
})
