import { expect, test, type Page } from "@playwright/test"

import { trackPageErrors } from "./helpers"

/**
 * Plans (spec §25.1). Real plans are only read. Writes go to one dedicated
 * plan, created on the first run and reused after (the API has no plan
 * delete). It stays inactive and hidden, so stores never see it.
 */
const E2E_SLUG = "e2e-test-plan"
const E2E_NAME = "E2E test plan"

test.describe.configure({ mode: "serial" })

async function openE2EPlan(page: Page) {
  await page.goto("/plans")
  // Wait for the list before deciding whether the test plan exists.
  await expect(page.getByRole("row").filter({ hasText: "Basic" }).first()).toBeVisible()
  const row = page.getByRole("row").filter({ hasText: E2E_NAME })
  if ((await row.count()) === 0) {
    await page.getByRole("link", { name: "New plan" }).click()
    await page.getByLabel("Name").fill(E2E_NAME)
    await page.getByLabel("Slug").fill(E2E_SLUG)
    // Sort it after the real plans.
    await page.getByLabel("Order").fill("9999")
    await page.getByRole("switch", { name: "Show on the pricing page" }).click()
    await page.getByRole("button", { name: "Create plan" }).click()
    await page.waitForURL(/\/plans\/\d+\?tab=prices/)
  } else {
    await row.first().getByRole("link").first().click()
    await page.waitForURL(/\/plans\/\d+/)
  }
  await expect(page.getByRole("heading", { level: 1, name: E2E_NAME })).toBeVisible()
}

test("the list shows every plan and opens its editor", async ({ page }) => {
  const errors = trackPageErrors(page)
  await page.goto("/plans")
  await expect(page.getByRole("heading", { level: 1, name: "Plans" })).toBeVisible()
  await expect(page.getByRole("row").filter({ hasText: "Basic" }).first()).toBeVisible()

  await page.getByRole("row").filter({ hasText: "Basic" }).first().getByRole("link").first().click()
  await expect(page.getByRole("heading", { level: 1, name: "Basic" })).toBeVisible()
  for (const tab of ["Details", "Prices", "Features", "Limits"]) {
    await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click()
    await expect(page).toHaveURL(tab === "Details" ? /\/plans\/\d+(\?tab=details)?$/ : new RegExp(`tab=${tab.toLowerCase()}`))
  }
  expect(errors).toEqual([])
})

test("details save, and the test plan stays hidden and inactive", async ({ page }) => {
  await openE2EPlan(page)
  await page.getByRole("tab", { name: "Details" }).click()
  const tagline = `Checked ${new Date().toISOString()}`
  await page.getByLabel("Tagline").fill(tagline)
  await page.getByLabel("Order").fill("9999")
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByText("Plan saved")).toBeVisible()
  await expect(page.getByRole("switch", { name: "Show on the pricing page" })).not.toBeChecked()
  await expect(page.getByText("Inactive", { exact: true }).first()).toBeVisible()
})

test("prices validate, add, and warn before replacing", async ({ page }) => {
  await openE2EPlan(page)
  await page.getByRole("tab", { name: /^Prices/ }).click()
  await page.getByRole("button", { name: "Add price" }).click()

  const dialog = page.getByRole("dialog", { name: "Add a price" })
  await dialog.getByRole("button", { name: "Add price" }).click()
  await expect(dialog.getByText("Choose a currency.")).toBeVisible()
  await expect(dialog.getByText("Enter an amount like 20 or 19.99.")).toBeVisible()

  await dialog.getByLabel("Currency").fill("USD")
  await page.getByRole("option", { name: /^USD/ }).click()
  await dialog.getByLabel("Amount").fill("1.50")
  await dialog.getByLabel("Trial days").fill("0")
  await dialog.getByRole("button", { name: "Add price" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole("row").filter({ hasText: "$1.50" }).filter({ hasText: "Active" }).first()).toBeVisible()

  // A second USD monthly price would replace the active one: the dialog says so.
  await page.getByRole("button", { name: "Add price" }).click()
  await dialog.getByLabel("Currency").fill("USD")
  await page.getByRole("option", { name: /^USD/ }).click()
  await expect(dialog.getByText(/This replaces the active USD monthly price/)).toBeVisible()
  await dialog.getByRole("button", { name: "Cancel" }).click()
})

test("a feature can be included and removed", async ({ page }) => {
  await openE2EPlan(page)
  await page.getByRole("tab", { name: /^Features/ }).click()
  await page.getByLabel("Search features").fill("gift")

  const toggle = page.getByRole("switch", { name: /Gift cards/ })
  const wasOn = await toggle.isChecked()
  await toggle.click()
  await expect(toggle).toBeChecked({ checked: !wasOn })
  await toggle.click()
  await expect(toggle).toBeChecked({ checked: wasOn })
})

test("limits save and restore", async ({ page }) => {
  await openE2EPlan(page)
  await page.getByRole("tab", { name: "Limits" }).click()

  const input = page.getByRole("textbox", { name: "Custom fields" })
  const original = await input.inputValue()
  await input.fill("x")
  await page.getByRole("button", { name: "Save limits" }).click()
  await expect(page.getByText("Enter a whole number.")).toBeVisible()

  await input.fill(String(Number(original || "0") + 1))
  await page.getByRole("button", { name: "Save limits" }).click()
  await expect(page.getByText("1 limit saved")).toBeVisible()

  await input.fill(original)
  await page.getByRole("button", { name: "Save limits" }).click()
  await expect(page.getByText("1 limit saved").last()).toBeVisible()
  await expect(input).toHaveValue(original)
})
