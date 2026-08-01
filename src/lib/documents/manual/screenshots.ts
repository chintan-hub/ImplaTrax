/**
 * Real app screenshots for the manual, captured by
 * `scripts/capture-manual-screenshots.mjs` into `public/manual-screenshots/`.
 * Centralized here so chapters reference one name instead of a hand-typed
 * path string, and so re-running the capture script never requires touching
 * chapter files. `ScreenshotFrame` falls back to its placeholder whenever
 * `imageSrc` is omitted, so a screenshot that hasn't been captured yet never
 * breaks the build.
 */
export const MANUAL_SCREENSHOTS = {
  onboardingAccount: '/manual-screenshots/onboarding-account.png',
  dashboardKpi: '/manual-screenshots/dashboard-kpi.png',
  productDetailMovements: '/manual-screenshots/product-detail-movements.png',
  salesInvoiceHeader: '/manual-screenshots/sales-invoice-header.png',
  poReceivePartial: '/manual-screenshots/po-receive-partial.png',
  settingsWorkspaceLogo: '/manual-screenshots/settings-workspace-logo.png',
} as const
