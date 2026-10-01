import { expect, test } from "@playwright/test"

const OUT = "C:/Users/amuibi/AppData/Local/Temp/claude/c--my-project-tenant-ecommerce-frontend/0cd62230-9511-438f-b4f0-9675b59b7b68/scratchpad/shots"

test("drawers", async ({ page }) => {
  test.setTimeout(300_000)
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto("/notifications?tab=channels")
  await page.getByRole("button", { name: "Change" }).first().click()
  await page.getByRole("dialog").getByRole("checkbox").first().waitFor()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/m-audience.png` })

  await page.goto("/plans")
  await page.getByRole("row").nth(1).getByRole("link").first().click()
  await page.getByRole("tab", { name: "Prices" }).click()
  await page.getByRole("button", { name: "Add price" }).click()
  await page.getByRole("dialog").waitFor()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/m-price.png` })
})
