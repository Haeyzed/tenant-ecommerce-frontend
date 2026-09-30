import { test as setup } from "@playwright/test"

import { ADMIN, signIn, STATE } from "./helpers"

/** Signs in once and saves the session for the other tests. */
setup("sign in as a platform admin", async ({ page }) => {
  await signIn(page, ADMIN)
  await page.context().storageState({ path: STATE })
})
