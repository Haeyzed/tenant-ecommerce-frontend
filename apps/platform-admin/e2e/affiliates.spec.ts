import { expect, test } from "@playwright/test"

import { trackPageErrors } from "./helpers"

/**
 * Affiliates (spec §25.1). Needs the local demo data from
 * `php artisan affiliates:demo`: affiliate E2EAFF with three referrals
 * (payable, flagged, on hold), a pending applicant and one payout. Every
 * dialog is opened, checked and cancelled; nothing is approved or paid.
 */
// Each test loads several fresh pages; the dev server compiles them on first visit.
test.describe.configure({ mode: "serial", timeout: 180_000 })

test("the list finds affiliates by code and opens one", async ({ page }) => {
  const errors = trackPageErrors(page)
  await page.goto("/affiliates")
  await expect(page.getByRole("heading", { level: 1, name: "Affiliates" })).toBeVisible()
  await page.getByLabel("Search affiliates").fill("E2EAFF")
  await expect(page).toHaveURL(/search=E2EAFF/)
  const row = page.getByRole("row").filter({ hasText: "E2E Affiliate" })
  await expect(row).toBeVisible()
  await row.getByRole("link").first().click()
  await expect(page.getByRole("heading", { level: 1, name: "E2E Affiliate" })).toBeVisible()
  await expect(page.getByText("E2EAFF", { exact: true })).toBeVisible()
  await expect(page.getByText("Account numbers show their last four digits.", { exact: false })).toBeVisible()
  expect(errors).toEqual([])
})

test("approving an applicant is confirmed, with an optional code", async ({ page }) => {
  await page.goto("/affiliates?search=e2e-applicant")
  await page.getByRole("row").filter({ hasText: "E2E Applicant" }).getByRole("link").first().click()
  await page.getByRole("button", { name: "Approve" }).click()
  const approve = page.getByRole("alertdialog")
  await expect(approve.getByText("Approve E2E Applicant?")).toBeVisible()
  await expect(approve.getByLabel("Referral code (optional)")).toBeVisible()
  await approve.getByRole("button", { name: "Cancel" }).click()
  await expect(approve).toBeHidden()
})

test("a custom commission rate is validated and needs a reason", async ({ page }) => {
  await page.goto("/affiliates?search=E2EAFF")
  await page.getByRole("row").filter({ hasText: "E2E Affiliate" }).getByRole("link").first().click()
  await page.getByRole("button", { name: "Change rate" }).click()
  const rate = page.getByRole("dialog")
  await rate.getByLabel("Rate").fill("150")
  await rate.getByRole("button", { name: "Save rate" }).click()
  await expect(rate.getByText("Enter a rate from 0 to 100, or leave it empty.")).toBeVisible()
  await expect(rate.getByText("Give a reason. It is kept with the affiliate's history.")).toBeVisible()
  await rate.getByRole("button", { name: "Cancel" }).click()
  await expect(rate).toBeHidden()
})

test("a flagged referral shows its flag and clearing it needs a note", async ({ page }) => {
  await page.goto("/affiliate-referrals?review=true")
  const row = page.getByRole("row").filter({ hasText: "Shoprite" })
  await expect(row.getByText("To review")).toBeVisible()
  await expect(row.getByText("Shared payment method")).toBeVisible()
  await row.getByRole("button", { name: "Clear flags" }).click()
  const dialog = page.getByRole("alertdialog")
  await dialog.getByRole("button", { name: "Clear flags" }).click()
  await expect(dialog.getByText("Enter a note.")).toBeVisible()
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(dialog).toBeHidden()
})

test("commissions follow the hold and review rules", async ({ page }) => {
  await page.goto("/affiliate-commissions?affiliate=" + (await affiliateId(page)))
  const onHold = page.getByRole("row").filter({ hasText: "Champella Ventures" })
  await expect(onHold.getByText(/^From /)).toBeVisible()
  await expect(onHold.getByRole("button", { name: "Approve" })).toHaveCount(0)

  const flagged = page.getByRole("row").filter({ hasText: "Shoprite" })
  await flagged.getByRole("button", { name: "Approve" }).click()
  const dialog = page.getByRole("alertdialog")
  await expect(dialog.getByText("This commission was flagged for review.", { exact: false })).toBeVisible()
  await dialog.getByRole("button", { name: "Approve" }).click()
  await expect(dialog.getByText("Enter a note.")).toBeVisible()
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(dialog).toBeHidden()
})

test("a payout shows where to pay and marking it paid needs the transfer reference", async ({ page }) => {
  await page.goto("/affiliate-payouts?pstatus=pending")
  await page.getByRole("row").filter({ hasText: "AFP-" }).first().getByRole("link").first().click()
  await expect(page.getByText("Included commissions")).toBeVisible()
  await expect(page.getByText("0123456789")).toBeVisible()
  await page.getByRole("button", { name: "Mark paid" }).click()
  const dialog = page.getByRole("alertdialog")
  await dialog.getByRole("button", { name: "Mark paid" }).click()
  await expect(dialog.getByText("Enter the transfer reference.")).toBeVisible()
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(dialog).toBeHidden()
})

/** The demo affiliate's id, read from its row link. */
async function affiliateId(page: import("@playwright/test").Page): Promise<string> {
  await page.goto("/affiliates?search=E2EAFF")
  const href = await page.getByRole("row").filter({ hasText: "E2E Affiliate" }).getByRole("link").first().getAttribute("href")
  const id = href?.split("/").pop()
  if (!id) throw new Error("Run php artisan affiliates:demo first.")
  return id
}
