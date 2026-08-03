// Generates the static PDF served at public/docs/user-guide.pdf — the file
// UserGuideModal's iframe and the floating Help / Settings > About triggers
// all point at. The manual itself is still authored as a React tree
// (src/lib/documents/manual) and rendered client-side by
// ManualDownloadButton; this script just drives that exact same download
// once, headlessly, and saves the result as a versioned static asset so a
// fresh Vercel preview can serve it with no app code running at all. Run
// with the dev server already up:
//
//   npm run dev                 (in one terminal)
//   npm run docs:generate       (in another)
import { chromium } from 'playwright'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_PATH = path.join(ROOT, 'public', 'docs', 'user-guide.pdf')

const BASE_URL = process.env.MANUAL_SCREENSHOT_BASE_URL ?? 'http://localhost:5173'
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH

const DEMO = {
  workspaceName: 'Bright Smile Dental Lab',
  yourName: 'Ava Patel',
  email: 'ava@brightsmile.example',
  password: 'DemoPass123!',
  pin: ['1', '2', '3', '4'],
}

async function isVisible(locator) {
  return locator.isVisible().catch(() => false)
}

async function main() {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  console.log(`Generating user guide PDF from ${BASE_URL} -> ${OUT_PATH}`)

  const browser = await chromium.launch(CHROMIUM_PATH ? { executablePath: CHROMIUM_PATH } : {})
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
  const page = await context.newPage()

  await page.goto(BASE_URL)
  await page.waitForTimeout(700)

  await page.getByRole('button', { name: 'Create Workspace' }).click()
  await page.waitForTimeout(300)
  await page.fill('#workspaceName', DEMO.workspaceName)
  await page.fill('#yourName', DEMO.yourName)
  await page.fill('#email', DEMO.email)
  await page.fill('#password', DEMO.password)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForTimeout(300)
  const companyContinue = page.getByRole('button', { name: 'Continue' })
  if (await isVisible(companyContinue)) {
    await companyContinue.click()
    await page.waitForTimeout(300)
  }
  for (let round = 0; round < 2; round++) {
    for (const d of DEMO.pin) {
      await page.getByRole('button', { name: d, exact: true }).click()
      await page.waitForTimeout(60)
    }
    await page.waitForTimeout(400)
  }
  const finishBtn = page.getByRole('button', { name: /^Finish/ })
  if (await isVisible(finishBtn)) {
    await finishBtn.click()
    await page.waitForTimeout(600)
  }
  const pinPad = page.getByRole('group', { name: /numpad/i })
  if (await isVisible(pinPad)) {
    for (const d of DEMO.pin) {
      await page.getByRole('button', { name: d, exact: true }).click()
      await page.waitForTimeout(80)
    }
    await page.waitForTimeout(600)
  }
  const skipBtn = page.getByRole('button', { name: 'Skip' })
  if (await isVisible(skipBtn)) {
    await skipBtn.click()
    await page.waitForTimeout(400)
  }

  // Settings > About — client-side navigation only, no reload (a reload
  // would re-lock the session behind the PIN screen).
  await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
  await page.waitForTimeout(500)
  const aboutTab = page.getByRole('tab', { name: 'About' })
  if (await isVisible(aboutTab)) {
    await aboutTab.click()
    await page.waitForTimeout(400)
  }

  const downloadPromise = page.waitForEvent('download', { timeout: 60000 })
  await page.getByRole('button', { name: /Download User Manual/i }).first().click()
  console.log('clicked download, waiting for render...')
  const download = await downloadPromise
  await download.saveAs(OUT_PATH)
  console.log('saved to', OUT_PATH)

  await browser.close()
  console.log('DONE')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
