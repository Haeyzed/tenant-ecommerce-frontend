import { expect, type Page } from "@playwright/test"

export const OWNER = process.env.E2E_OWNER_EMAIL ?? "owner@demo.test"
export const CLERK = process.env.E2E_CLERK_EMAIL ?? "clerk@demo.test"
export const PASSWORD = process.env.E2E_PASSWORD ?? ""

/** Saved sessions from auth.setup.ts (git-ignored under test-results). */
export const STATE = {
  owner: "test-results/.auth/owner.json",
  clerk: "test-results/.auth/clerk.json",
}

/** Signs in through the real login form and BFF. */
export async function signIn(page: Page, email: string) {
  if (!PASSWORD) throw new Error("Set E2E_PASSWORD to run the end-to-end tests.")

  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL((url) => url.pathname === "/", { waitUntil: "commit" })
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
}
