import { expect, test } from "@playwright/test"

import { STATE } from "./helpers"

test.describe("product list (spec §18.3, §19.1)", () => {
  test.use({ storageState: STATE.owner })

  test.beforeEach(async ({ page }) => {
    await page.goto("/products")
    await expect(page.getByRole("table")).toBeVisible()
  })

  test("search is URL state and distinguishes no results from no data", async ({
    page,
  }) => {
    await page.getByLabel("Search products").fill("zzzz-nothing-matches")
    await expect(page).toHaveURL(/search=zzzz-nothing-matches/)
    await expect(page.getByText("No products match your filters")).toBeVisible()

    await page.getByRole("button", { name: "Clear filters" }).click()
    await expect(page.getByRole("table")).toBeVisible()
  })

  test("bulk deactivate and reactivate report per-item results", async ({
    page,
  }) => {
    await page.getByLabel("Search products").fill("linen")
    await expect(page).toHaveURL(/search=linen/)
    await expect(page.locator("table tbody tr")).toHaveCount(2)

    await page
      .getByRole("checkbox", { name: "Select all rows on this page" })
      .click()
    const bar = page.getByRole("region", { name: "Bulk actions" })
    await expect(bar).toContainText("2 selected")

    await bar.getByRole("button", { name: "Deactivate" }).click()
    await expect(page.getByText("2 products deactivated")).toBeVisible()
    await expect(page.locator("table tbody").getByText("Inactive")).toHaveCount(
      2
    )

    await page
      .getByRole("checkbox", { name: "Select all rows on this page" })
      .click()
    await bar.getByRole("button", { name: "Activate", exact: true }).click()
    await expect(page.getByText("2 products activated")).toBeVisible()
  })

  test("delete asks for confirmation naming the product", async ({ page }) => {
    const actions = page.locator("table tbody tr").first().getByRole("button", { name: /Actions for/ })
    const name = ((await actions.getAttribute("aria-label")) ?? "").replace("Actions for ", "")

    await actions.click()
    await page.getByRole("menuitem", { name: "Delete" }).click()
    await expect(page.getByRole("alertdialog")).toContainText(`Delete ${name}?`)
    await page.getByRole("button", { name: "Cancel" }).click()
    await expect(page.getByRole("alertdialog")).toBeHidden()
  })

  test("pagination moves through pages", async ({ page }) => {
    const pager = page.getByRole("navigation", { name: "Pagination" })
    await expect(pager).toContainText(/of \d+/)
    const next = pager.getByRole("button", { name: "Next page" })

    if (await next.isEnabled()) {
      await next.click()
      await expect(page).toHaveURL(/page=2/)
    }
  })
})
