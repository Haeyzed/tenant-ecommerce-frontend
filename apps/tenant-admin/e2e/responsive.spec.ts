import { expect, test } from "@playwright/test"

import { STATE } from "./helpers"

test.describe("mobile layout (spec §18.3, §33)", () => {
  test.use({ storageState: STATE.owner })

  test("lists render as cards, filters open in a sheet, and nothing overflows", async ({
    page,
  }) => {
    await page.goto("/products")

    await expect(page.getByRole("list", { name: "Records" })).toBeVisible()
    await expect(page.getByRole("table")).toBeHidden()

    await page.getByRole("button", { name: /Filters/ }).click()
    await expect(
      page.getByRole("dialog", { name: "Filter products" })
    ).toBeVisible()
    await page.keyboard.press("Escape")

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
