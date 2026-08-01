// Captures the 6 real app screenshots used by the User Manual PDF
// (src/lib/documents/manual) straight from a running instance of the app —
// onboards a fresh demo workspace, walks through the exact screens the
// manual documents, and saves high-resolution (2x) PNGs into
// public/manual-screenshots/. Run with the dev server already up:
//
//   npm run dev            (in one terminal)
//   npm run screenshots:manual   (in another)
//
// Everything here is plain client-side state (no backend), so a fresh
// browser context with an empty localStorage is all a full run needs.
import { chromium } from 'playwright'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'public', 'manual-screenshots')

// Overridable for CI/sandboxed environments that ship Chromium at a
// non-default path, or to point at a Vercel preview instead of localhost.
const BASE_URL = process.env.MANUAL_SCREENSHOT_BASE_URL ?? 'http://localhost:5173'
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH

const DEMO = {
  workspaceName: 'Bright Smile Dental Lab',
  yourName: 'Ava Patel',
  email: 'ava@brightsmile.example',
  password: 'DemoPass123!',
  companyName: 'Bright Smile Dental Lab',
  pin: ['1', '2', '3', '4'],
}

async function shoot(page, filename) {
  await page.screenshot({ path: path.join(OUT_DIR, filename) })
  console.log('captured', filename)
}

async function isVisible(locator) {
  return locator.isVisible().catch(() => false)
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  console.log(`Capturing manual screenshots from ${BASE_URL} -> ${OUT_DIR}`)

  const browser = await chromium.launch(CHROMIUM_PATH ? { executablePath: CHROMIUM_PATH } : {})
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (err) => errors.push(String(err)))

  await page.goto(BASE_URL)
  await page.waitForTimeout(700)
  // Radix tooltips here are click-toggled (for touch support), so an
  // incidental hover-then-click along a mouse path can leave one open and
  // portaled above everything in a later screenshot — just suppress the
  // whole category rather than choreograph the cursor around every icon.
  await page.addStyleTag({ content: '[role="tooltip"] { display: none !important; }' })

  // --- Onboarding: account step ------------------------------------------------
  await page.getByRole('button', { name: 'Create Workspace' }).click()
  await page.waitForTimeout(350)
  await page.fill('#workspaceName', DEMO.workspaceName)
  await page.fill('#yourName', DEMO.yourName)
  await page.fill('#email', DEMO.email)
  await page.fill('#password', DEMO.password)
  await page.waitForTimeout(250)
  await shoot(page, 'onboarding-account.png')

  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForTimeout(350)

  // --- Onboarding: company step — upload a demo logo so it's live for the ---
  // --- sales-invoice header and Workspace Logo card screenshots later ------
  const demoLogoPath = path.join(ROOT, 'public', 'icon-512.png')
  const logoInput = page.locator('input[type="file"]')
  if ((await logoInput.count()) > 0 && fs.existsSync(demoLogoPath)) {
    await logoInput.setInputFiles(demoLogoPath)
    await page.waitForTimeout(300)
  }
  await page.fill('#companyName', DEMO.companyName).catch(() => {})
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForTimeout(350)

  // --- PIN: create + confirm ------------------------------------------------
  for (let round = 0; round < 2; round++) {
    for (const d of DEMO.pin) {
      await page.getByRole('button', { name: d, exact: true }).click()
      await page.waitForTimeout(60)
    }
    await page.waitForTimeout(300)
  }

  const finishBtn = page.getByRole('button', { name: /^Finish/ })
  if (await isVisible(finishBtn)) {
    await finishBtn.click()
  }
  await page.waitForTimeout(700)

  // Some flows re-present a lock-screen PIN pad or a tour-skip prompt right
  // after finishing onboarding — handle both defensively.
  const pinPad = page.getByRole('group', { name: /numpad/i })
  if (await isVisible(pinPad)) {
    for (const d of DEMO.pin) {
      await page.getByRole('button', { name: d, exact: true }).click()
      await page.waitForTimeout(70)
    }
    await page.waitForTimeout(500)
  }
  const skipBtn = page.getByRole('button', { name: 'Skip' })
  if (await isVisible(skipBtn)) {
    await skipBtn.click()
    await page.waitForTimeout(400)
  }

  // --- Dashboard: KPI row + trend charts ------------------------------------
  await page.waitForTimeout(1800) // let recharts finish its entrance animation
  await shoot(page, 'dashboard-kpi.png')

  // --- Product detail: movement history -------------------------------------
  // All in-app navigation below uses Sidebar links / client-side routing —
  // page.goto() would trigger a full reload and re-lock the session behind
  // the PIN screen.
  await page.getByRole('link', { name: 'Products', exact: true }).click()
  await page.waitForTimeout(500)

  const cards = page.locator('.grid.gap-4 > div')
  const cardCount = Math.min(await cards.count(), 10)
  let bestIndex = 0
  let bestScore = -1
  const dialog = page.getByRole('dialog')
  for (let i = 0; i < cardCount; i++) {
    await cards.nth(i).click()
    await page.waitForTimeout(350)
    // Movement rows render their signed quantity in a success/danger-colored
    // span — counting them is a cheap, text-independent proxy for "this
    // product has a rich, non-empty history" worth screenshotting.
    const score = await dialog.locator('.text-success-600, .text-danger-600').count()
    if (score > bestScore) {
      bestScore = score
      bestIndex = i
    }
    // The sheet has both a footer "Close" button and a top-right icon Close
    // button (sr-only "Close" label) — the icon one is the reliable one,
    // rendered last in the DOM regardless of which footer actions exist.
    await dialog.getByRole('button', { name: 'Close' }).last().click()
    // The overlay's fade-out animation keeps intercepting pointer events for
    // a beat after closing — wait for it to actually detach before the next
    // card click, or that click times out fighting the closing backdrop.
    await dialog.waitFor({ state: 'hidden' }).catch(() => {})
    await page.waitForTimeout(150)
  }
  // The sheet is viewport-height (h-screen) with its quantity fields and
  // movement ledger stacked in one internally-scrolling body — at the
  // normal 1000px viewport the ledger sits below the fold. Growing the
  // viewport just for this capture is simpler and more faithful than
  // scrolling mid-screenshot, since it fits the whole sheet in one frame.
  await page.setViewportSize({ width: 1600, height: 2600 })
  await cards.nth(bestIndex).click()
  await page.waitForTimeout(400)

  // The sheet body is naturally shorter than the 2600px viewport it's given
  // room to breathe in — screenshotting the dialog's own bounding box (which
  // is always full viewport height, h-full) would leave a large dead strip
  // below the last history row. Measure where the content actually ends and
  // clip there instead, with a small allowance for the footer beneath it.
  const clipBox = await page.evaluate(() => {
    const dialogEl = document.querySelector('[role="dialog"]')
    const body = dialogEl?.querySelector('.overflow-y-auto')
    if (!dialogEl || !body) return null
    const dRect = dialogEl.getBoundingClientRect()
    // scrollHeight is useless here: the body is a flex-1 child, so with
    // 2600px of room and ~1000px of actual content it still reports its own
    // stretched clientHeight (no true overflow to measure). Walking every
    // descendant for the lowest bounding-box bottom finds where the visible
    // content really ends instead.
    let maxBottom = body.getBoundingClientRect().top
    body.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect()
      if (r.height > 0 && r.bottom > maxBottom) maxBottom = r.bottom
    })
    return {
      x: dRect.left,
      y: dRect.top,
      width: dRect.width,
      height: Math.min(dRect.height, maxBottom - dRect.top + 80),
    }
  })
  await page.screenshot({ path: path.join(OUT_DIR, 'product-detail-movements.png'), clip: clipBox ?? undefined })
  console.log('captured product-detail-movements.png')
  await dialog.getByRole('button', { name: 'Close' }).last().click()
  await dialog.waitFor({ state: 'hidden' }).catch(() => {})
  await page.waitForTimeout(150)
  await page.setViewportSize({ width: 1600, height: 1000 })

  // --- Settings / Workspace / Workspace Logo --------------------------------
  // "Team" links straight to /settings?tab=workspace.
  await page.getByRole('link', { name: 'Team', exact: true }).click()
  await page.waitForTimeout(600)
  const logoCard = page.locator('div.rounded-xl', { hasText: 'Workspace Logo' }).first()
  if (await isVisible(logoCard)) {
    await logoCard.screenshot({ path: path.join(OUT_DIR, 'settings-workspace-logo.png') })
    console.log('captured settings-workspace-logo.png')
  } else {
    console.warn('Workspace Logo card not found — skipping settings-workspace-logo.png')
  }

  // --- Sales Invoice: white-label header -------------------------------------
  await page.getByRole('link', { name: 'Sales', exact: true }).click()
  await page.waitForTimeout(500)
  const saleRows = page.locator('table tbody tr')
  if ((await saleRows.count()) > 0) {
    await saleRows.first().click()
    await page.waitForTimeout(500)
    // The printable invoice is a real DOM node (`hidden print:block`), not a
    // modal — emulating print media is what makes it visible without
    // actually opening the OS print dialog.
    await page.emulateMedia({ media: 'print' })
    await page.waitForTimeout(300)
    const invoiceEl = page.locator('div[class*="print:block"]')
    if (await isVisible(invoiceEl)) {
      await invoiceEl.screenshot({ path: path.join(OUT_DIR, 'sales-invoice-header.png') })
      console.log('captured sales-invoice-header.png')
    } else {
      console.warn('Printable invoice container not found — skipping sales-invoice-header.png')
    }
    await page.emulateMedia({ media: 'screen' })
  } else {
    console.warn('No sales found — skipping sales-invoice-header.png')
  }

  // --- Receive Purchase Order: partial receipt blocked ------------------------
  await page.getByRole('link', { name: 'Purchase Orders', exact: true }).click()
  await page.waitForTimeout(500)
  const poRows = page.locator('table tbody tr')
  const poCount = Math.min(await poRows.count(), 20)
  let receiveOpened = false
  for (let i = 0; i < poCount; i++) {
    await poRows.nth(i).click()
    await page.waitForTimeout(400)
    const receiveBtn = page.getByRole('button', { name: 'Receive' })
    if (await isVisible(receiveBtn)) {
      await receiveBtn.click()
      await page.waitForTimeout(400)
      receiveOpened = true
      break
    }
    await page.goBack()
    await page.waitForTimeout(400)
  }

  if (receiveOpened) {
    // Reduce the first non-zero line below what's outstanding — that alone
    // flips the whole receipt into "partial", surfacing the required-photo
    // state without needing to attach a real file.
    const qtyInputs = page.locator('input[id^="recv-"]')
    const n = await qtyInputs.count()
    for (let i = 0; i < n; i++) {
      const current = Number(await qtyInputs.nth(i).inputValue())
      if (current > 0) {
        await qtyInputs.nth(i).fill(String(Math.floor(current / 2)))
        break
      }
    }
    await page.waitForTimeout(300)
    await page.getByRole('dialog').screenshot({ path: path.join(OUT_DIR, 'po-receive-partial.png') })
    console.log('captured po-receive-partial.png')
  } else {
    console.warn('No receivable purchase order found — skipping po-receive-partial.png')
  }

  console.log('errors during capture:', JSON.stringify(errors))
  await browser.close()
  console.log('Done. Screenshots written to', OUT_DIR)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
