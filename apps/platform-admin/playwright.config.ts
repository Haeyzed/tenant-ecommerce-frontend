import { defineConfig, devices } from "@playwright/test"

/**
 * End-to-end tests (spec §35.3) against a running platform-admin and
 * backend. E2E_BASE_URL defaults to the local dev server; credentials come
 * from the environment (E2E_ADMIN_EMAIL, E2E_PASSWORD).
 *
 * Sign-in happens once in the setup project and the saved session is
 * reused. Locally the suite runs on one worker: Laravel Herd serves few
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
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    ...(process.env.CI ? {} : { channel: "chrome" }),
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, storageState: "e2e/.auth/admin.json" },
      dependencies: ["setup"],
      testIgnore: /\.mobile\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], storageState: "e2e/.auth/admin.json" },
      dependencies: ["setup"],
      testMatch: /\.mobile\.spec\.ts/,
    },
  ],
})
