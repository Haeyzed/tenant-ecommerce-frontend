import { expect, test } from "@playwright/test"

import { OWNER, PASSWORD, STATE } from "./helpers"

test.describe("staff authentication (spec §35.3)", () => {
  test("redirects a signed-out visitor to login and back after sign-in", async ({ page }) => {
    await page.goto("/products")
    await expect(page).toHaveURL(/\/login\?next=%2Fproducts/)

    await page.getByLabel("Email").fill(OWNER)
    await page.getByLabel("Password").fill(PASSWORD)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/products$/)
  })

  test("shows the server message for wrong credentials", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill(OWNER)
    await page.getByLabel("Password").fill("definitely-wrong")
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByRole("alert")).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test.describe("as the owner", () => {
    test.use({ storageState: STATE.owner })

    test("never exposes the token to the page", async ({ page, context }) => {
      await page.goto("/")
      const session = (await context.cookies()).find((c) => c.name.endsWith("staff"))

      expect(session?.httpOnly).toBe(true)
      expect(await page.evaluate(() => document.cookie)).not.toContain("staff=")
      const status = await page.evaluate(async () => (await fetch("/bff/session")).json())
      expect(status).toMatchObject({ authenticated: true, actor: "staff" })
      expect(JSON.stringify(status)).not.toContain("tea_")
    })
  })

  test.describe("as a clerk", () => {
    test.use({ storageState: STATE.clerk })

    test("sees fewer actions than the owner", async ({ page }) => {
      await page.goto("/products")
      await expect(page.getByRole("table")).toBeVisible()
      await expect(page.getByRole("link", { name: "Add product" })).toHaveCount(0)
      await expect(page.getByRole("checkbox", { name: "Select all rows on this page" })).toHaveCount(0)
    })
  })

  test("logs out and clears the session", async ({ page }) => {
    // Its own sign-in: logging out revokes the token, which must not affect the saved sessions.
    await page.goto("/login")
    await page.getByLabel("Email").fill(OWNER)
    await page.getByLabel("Password").fill(PASSWORD)
    await page.getByRole("button", { name: "Sign in" }).click()
    await page.waitForURL((url) => url.pathname === "/", { waitUntil: "commit" })

    await page.getByRole("button", { name: new RegExp(OWNER.replace(".", "\\."), "i") }).click()
    await page.getByRole("menuitem", { name: "Log out" }).click()
    await expect(page).toHaveURL(/\/login/)

    await page.goto("/products")
    await expect(page).toHaveURL(/\/login/)
  })
})
