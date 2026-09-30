import { expect, test } from "@playwright/test"

import { trackPageErrors } from "./helpers"

/**
 * Payment gateways (spec §25.1). Nothing here saves keys (a save checks
 * them with the real provider) or changes the billing mode.
 */
test.describe("payment gateways", () => {
  test("lists every provider with its webhook URL, per mode", async ({ page }) => {
    const errors = trackPageErrors(page)
    await page.goto("/payment-gateways")

    await expect(page.getByRole("heading", { level: 1, name: "Payment gateways" })).toBeVisible()
    await expect(page.getByTestId("gateway-name")).toHaveText(["Paystack", "Flutterwave", "Stripe"])
    await expect(page.getByText(/\/api\/webhooks\/paystack\/(test|live)$/)).toBeVisible()

    await page.getByRole("tab", { name: "Live keys" }).click()
    await expect(page.getByText(/\/api\/webhooks\/paystack\/live$/)).toBeVisible()
    await page.getByRole("tab", { name: "Test keys" }).click()
    await expect(page.getByText(/\/api\/webhooks\/paystack\/test$/)).toBeVisible()

    expect(errors).toEqual([])
  })

  test("the credentials form validates before calling the provider", async ({ page }) => {
    await page.goto("/payment-gateways?mode=test")
    const card = page.locator("[data-slot=card]").filter({ hasText: "Stripe" })
    await card.getByRole("button", { name: /Connect|Update keys/ }).click()

    const sheet = page.getByRole("dialog")
    await expect(sheet.getByRole("heading", { name: /Stripe \(test\)/ })).toBeVisible()
    await expect(sheet.getByLabel("Secret key")).toHaveAttribute("type", "password")

    // Clear any currencies, then submit: nothing is sent to the provider.
    for (const remove of await sheet.locator("[data-slot=combobox-chip-remove]").all()) await remove.click()
    await sheet.getByRole("button", { name: "Save credentials" }).click()
    await expect(sheet.getByText("Choose at least one currency.")).toBeVisible()

    await sheet.getByRole("button", { name: "Cancel" }).click()
    await expect(sheet).toBeHidden()
  })

  test("switching the billing mode asks for a reason", async ({ page }) => {
    await page.goto("/payment-gateways")
    await page.getByRole("button", { name: /Switch to (live|test)/ }).click()

    const dialog = page.getByRole("alertdialog")
    await expect(dialog.getByLabel("Reason")).toBeVisible()
    await dialog.getByRole("button", { name: /Go live|Switch to test/ }).click()
    await expect(dialog.getByText("Give a reason. It is kept in the activity log.")).toBeVisible()

    await dialog.getByRole("button", { name: "Cancel" }).click()
    await expect(dialog).toBeHidden()
  })
})
