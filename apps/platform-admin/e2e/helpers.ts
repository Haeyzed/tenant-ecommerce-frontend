import { expect, type Page } from "@playwright/test"

export const ADMIN = process.env.E2E_ADMIN_EMAIL ?? "qa-admin@platform.test"
export const PASSWORD = process.env.E2E_PASSWORD ?? ""

/** The saved session from auth.setup.ts (git-ignored). */
export const STATE = "e2e/.auth/admin.json"

/** Signs in through the real login form and BFF. */
export async function signIn(page: Page, email: string) {
  if (!PASSWORD) throw new Error("Set E2E_PASSWORD to run the end-to-end tests.")

  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL((url) => url.pathname === "/dashboard", { waitUntil: "commit" })
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
}

/** Collects uncaught page errors so a test can assert there were none. */
export function trackPageErrors(page: Page): string[] {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(String(error)))
  return errors
}
