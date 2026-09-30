import { defineConfig, devices } from "@playwright/test"

/**
 * End-to-end tests (spec §35.3) against a running tenant-admin and backend.
 * E2E_BASE_URL defaults to the local dev server; credentials come from the
 * environment (E2E_OWNER_EMAIL, E2E_CLERK_EMAIL, E2E_PASSWORD).
 *
 * Sign-in happens once per role in the setup project; the saved sessions
 * are reused, so the suite does not hammer the login endpoint. Locally the
 * suite runs on one worker: a laptop backend (Laravel Herd) serves few
 * concurrent PHP requests.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  workers: process.env.CI ? 2 : 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3001",
    trace: "retain-on-failure",
    ...(process.env.CI ? {} : { channel: "chrome" }),
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      dependencies: ["setup"],
      testIgnore: /responsive\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      dependencies: ["setup"],
      testMatch: /responsive\.spec\.ts/,
    },
  ],
})
