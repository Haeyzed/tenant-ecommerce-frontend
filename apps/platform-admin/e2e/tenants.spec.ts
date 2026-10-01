import { expect, test, type Page } from "@playwright/test"

import { trackPageErrors } from "./helpers"

/**
 * Tenants and database servers (spec §25.1). Lifecycle actions, overrides
 * and new servers are opened and cancelled, never confirmed: they would
 * change real stores. The one write, the demo store's commission rate, is
 * reset in the same test.
 */
test.describe.configure({ mode: "serial" })

async function openDemo(page: Page, tab?: string) {
  await page.goto("/tenants?search=demo")
  await page.getByRole("row").filter({ hasText: "Demo Store" }).first().getByRole("link").first().click()
  await expect(page.getByRole("heading", { level: 1, name: "Demo Store" })).toBeVisible()
  if (tab) await page.getByRole("tab", { name: tab }).click()
}

test("the list searches stores and opens one with its overview", async ({ page }) => {
  const errors = trackPageErrors(page)
  await page.goto("/tenants")
  await expect(page.getByRole("heading", { level: 1, name: "Tenants" })).toBeVisible()
  await page.getByLabel("Search tenants").fill("demo")
  await expect(page).toHaveURL(/search=demo/)
  await expect(page.getByRole("row").filter({ hasText: "Demo Store" }).first()).toBeVisible()

  await openDemo(page)
  await expect(page.getByText("Domains", { exact: true })).toBeVisible()
  await expect(page.getByText("Usage", { exact: true })).toBeVisible()
  await expect(page.getByText("Staff accounts")).toBeVisible()
  expect(errors).toEqual([])
})

test("lifecycle actions are confirmed, and close needs a reason", async ({ page }) => {
  await openDemo(page)
  await page.getByRole("button", { name: "More actions" }).click()
  await page.getByRole("menuitem", { name: "Close store" }).click()

  const dialog = page.getByRole("alertdialog")
  await expect(dialog.getByText(/Close Demo Store\?/)).toBeVisible()
  await dialog.getByRole("button", { name: "Close store" }).click()
  await expect(dialog.getByText("Give a reason. It is kept with the store's history.")).toBeVisible()
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText("Active", { exact: true }).first()).toBeVisible()
})

test("subscription and modules tabs show the plan and what it includes", async ({ page }) => {
  await openDemo(page, "Subscription")
  await expect(page.getByText("Current subscription")).toBeVisible()
  await expect(page.getByRole("link", { name: "Open subscription" })).toBeVisible()

  await page.getByRole("tab", { name: "Modules" }).click()
  await expect(page).toHaveURL(/tab=modules/)
  await page.getByLabel("Search modules").fill("point of sale")
  const row = page.getByRole("listitem").filter({ hasText: "Point of sale" })
  await expect(row).toBeVisible()
  await row.getByRole("button", { name: /Override|Change override/ }).click()
  const dialog = page.getByRole("dialog", { name: "Point of sale" })
  await expect(dialog.getByRole("radio", { name: /Grant/ })).toBeVisible()
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(dialog).toBeHidden()
})

test("a limit override validates before saving", async ({ page }) => {
  await openDemo(page, "Limits")
  const row = page.getByRole("row").filter({ hasText: "Products" })
  await expect(row).toBeVisible()
  await row.getByRole("button", { name: /Override|Change/ }).click()

  const dialog = page.getByRole("dialog", { name: "Products" })
  await dialog.getByLabel(/New limit/).fill("lots")
  await dialog.getByRole("button", { name: "Save override" }).click()
  await expect(dialog.getByText("Enter a whole number.")).toBeVisible()
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(dialog).toBeHidden()
})

test("the commission rate can be overridden and reset", async ({ page }) => {
  await openDemo(page, "Settings")
  const input = page.getByLabel("Rate for this store")
  await input.fill("150")
  await page.getByRole("button", { name: "Save rate" }).click()
  await expect(page.getByText(/Enter a percentage from 0 to 100/)).toBeVisible()

  await input.fill("2.5")
  await page.getByRole("button", { name: "Save rate" }).click()
  await expect(page.getByText("Commission rate saved")).toBeVisible()
  await expect(input).toHaveValue("2.5")

  await page.getByRole("button", { name: "Use platform default" }).click()
  await expect(page.getByText("Commission back to the platform default")).toBeVisible()
  await expect(input).toHaveValue("")
})

test("database servers show capacity and validate a new server", async ({ page }) => {
  const errors = trackPageErrors(page)
  await page.goto("/database-servers")
  await expect(page.getByRole("heading", { level: 1, name: "Database servers" })).toBeVisible()

  await page.getByRole("button", { name: "Add server" }).click()
  const dialog = page.getByRole("dialog", { name: "Add database server" })
  await dialog.getByRole("button", { name: "Add server" }).click()
  await expect(dialog.getByText("Enter a name.")).toBeVisible()
  await expect(dialog.getByText("Enter the password.")).toBeVisible()
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(dialog).toBeHidden()
  expect(errors).toEqual([])
})
