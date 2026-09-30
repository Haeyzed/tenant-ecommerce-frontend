import { test as setup } from "@playwright/test"

import { CLERK, OWNER, signIn, STATE } from "./helpers"

/** Signs in each role once and saves the session for the other tests. */
setup("sign in as the owner", async ({ page }) => {
  await signIn(page, OWNER)
  await page.context().storageState({ path: STATE.owner })
})

setup("sign in as a clerk", async ({ page }) => {
  await signIn(page, CLERK)
  await page.context().storageState({ path: STATE.clerk })
})
