import { test } from "@playwright/test"

const OUT = "C:/Users/amuibi/AppData/Local/Temp/claude/c--my-project-tenant-ecommerce-frontend/0cd62230-9511-438f-b4f0-9675b59b7b68/scratchpad/shots"

test("screens", async ({ page }) => {
  await page.goto("/notifications")
  await page.getByRole("row").nth(3).waitFor()
  await page.screenshot({ path: `${OUT}/templates.png` })
  await page.getByRole("row").filter({ hasText: "Provisioning complete" }).getByRole("button", { name: "Edit" }).click()
  await page.getByRole("dialog").getByText("Preview").waitFor()
  await page.screenshot({ path: `${OUT}/template-sheet.png` })
  await page.goto("/notifications?tab=channels")
  await page.getByRole("row").nth(3).waitFor()
  await page.screenshot({ path: `${OUT}/channels.png` })
  await page.goto("/legal-documents/4")
  await page.getByRole("heading", { level: 1 }).waitFor()
  await page.screenshot({ path: `${OUT}/legal-detail.png` })
  await page.getByRole("button", { name: /^Notifications/ }).click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/bell.png` })
})
