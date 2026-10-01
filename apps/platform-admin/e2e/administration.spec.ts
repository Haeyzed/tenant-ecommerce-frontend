import { expect, test } from "@playwright/test"

import { trackPageErrors } from "./helpers"

/**
 * Legal documents, platform users and notifications (spec §25.1). Forms are
 * opened, checked and cancelled, never saved: drafts, invitations and edited
 * wording would change what real stores and staff receive.
 */
test.describe.configure({ mode: "serial" })

test("legal documents list and a new version validates before saving", async ({ page }) => {
  const errors = trackPageErrors(page)
  await page.goto("/legal-documents")
  await expect(page.getByRole("heading", { level: 1, name: "Legal documents" })).toBeVisible()

  await page.getByRole("link", { name: "New version" }).click()
  await expect(page).toHaveURL(/\/legal-documents\/new/)
  await page.getByLabel("Title").fill("")
  await page.getByRole("button", { name: "Create draft" }).click()
  await expect(page.getByText("Enter a version, e.g. 2026-10.")).toBeVisible()
  await expect(page.getByText("Enter a title.")).toBeVisible()
  await expect(page.getByText("Enter the document text.")).toBeVisible()

  await page.goto("/legal-documents/new?type=privacy_policy")
  await expect(page.getByLabel("Document")).toHaveValue("privacy_policy")
  await expect(page.getByLabel("Title")).toHaveValue("Privacy policy")
  expect(errors).toEqual([])
})

test("platform users list and the invite form needs a role", async ({ page }) => {
  const errors = trackPageErrors(page)
  await page.goto("/platform-users")
  await expect(page.getByRole("heading", { level: 1, name: "Platform users" })).toBeVisible()
  await expect(page.getByRole("row").nth(1)).toBeVisible()

  await page.getByRole("button", { name: "Invite" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "Send invitation" }).click()
  await expect(dialog.getByText("Give at least one role.")).toBeVisible()
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(dialog).toBeHidden()
  expect(errors).toEqual([])
})

test("a message's wording rejects unknown placeholders and previews known ones", async ({ page }) => {
  const errors = trackPageErrors(page)
  await page.goto("/notifications?q=provisioning")
  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible()
  const row = page.getByRole("row").filter({ hasText: "Provisioning complete" })
  await row.getByRole("button", { name: "Edit" }).click()

  const sheet = page.getByRole("dialog")
  const message = sheet.getByLabel("Message", { exact: true })
  await message.fill("Hello {{ownr_name}}, ")
  await sheet.getByRole("button", { name: "Save" }).click()
  await expect(sheet.getByText(/Unknown placeholder \{\{ownr_name\}\}/)).toBeVisible()

  await message.fill("Hello ")
  await sheet.getByRole("button", { name: "{{owner_name}}" }).click()
  await expect(message).toHaveValue("Hello {{owner_name}}")
  await expect(sheet.getByLabel("Preview").getByText("Hello [owner_name]")).toBeVisible()

  await sheet.getByRole("button", { name: "Cancel" }).click()
  await expect(sheet).toBeHidden()
  expect(errors).toEqual([])
})

test("required messages keep their last channel", async ({ page }) => {
  await page.goto("/notifications?tab=channels")
  const row = page.getByRole("row").filter({ hasText: "Registration verification" })
  await expect(row.getByText("Required")).toBeVisible()
  // Email is its only channel, so it can't be switched off.
  await expect(row.getByRole("switch", { name: "Email for Registration verification" })).toBeDisabled()
  await expect(row.getByRole("switch", { name: "SMS for Registration verification" })).toBeEnabled()
})
