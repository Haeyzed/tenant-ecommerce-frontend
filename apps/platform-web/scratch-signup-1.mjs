// Temporary QA script (deleted after the run): sign-up steps 1-2 in a real browser.
import { chromium } from "@playwright/test"

const email = process.argv[2]
const shots = process.argv[3]
const browser = await chromium.launch({ channel: "chrome" })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on("pageerror", (e) => errors.push(String(e)))

await page.goto("http://localhost:3003/pricing")
await page.screenshot({ path: `${shots}/1-pricing.png`, fullPage: true })
await page.getByRole("link", { name: "Start free trial" }).first().click()
await page.waitForURL(/\/signup\?price=/)

// Submitting empty shows client validation.
await page.getByRole("button", { name: "Start my free trial" }).click()
await page.screenshot({ path: `${shots}/2-signup-errors.png`, fullPage: true })

await page.getByLabel("Business name").fill("QA Signup Store")
await page.locator("#country_id").fill("Niger")
await page.getByRole("option", { name: "Nigeria" }).click()
await page.getByLabel("Your name").fill("Qa Owner")
await page.getByLabel("Email").fill(email)
await page.getByLabel("Password", { exact: true }).fill("DemoPass123!")
await page.getByLabel("Confirm password").fill("DemoPass123!")
await page.locator("#coupon_code").fill("NOPE123")
await page.getByRole("button", { name: "Apply" }).click()
await page.getByText("This code doesn't exist.").waitFor()
await page.locator("#coupon_code").fill("")
for (const box of await page.getByRole("checkbox").all()) await box.click()
await page.screenshot({ path: `${shots}/3-signup-filled.png`, fullPage: true })
await page.getByRole("button", { name: "Start my free trial" }).click()
await page.waitForURL(/\/register\/verify\?registration=/, { timeout: 30_000 })
await page.getByText(email).waitFor()
await page.screenshot({ path: `${shots}/4-verify.png`, fullPage: true })

// A wrong code shows the inline error.
await page.locator("#code").fill("000000")
await page.getByText(/That code isn't right/).waitFor({ timeout: 15_000 })
await page.screenshot({ path: `${shots}/5-verify-wrong.png`, fullPage: true })

console.log("REGISTRATION=" + new URL(page.url()).searchParams.get("registration"))
console.log("ERRORS=" + JSON.stringify(errors))
await browser.close()
