import type { ClinicSettings } from '@/types'

/** Dev/demo-only — a realistic pre-filled clinic profile so local development and design review never start from a blank slate. Never used in a production build; see SEED in DataContext.tsx. */
export const defaultClinicSettings: ClinicSettings = {
  clinicName: 'DentoCrafts Implant & Prosthodontics',
  address: '4820 Meridian Ave, Suite 210, Austin, TX 78745',
  phone: '+1 (512) 555-0148',
  email: 'info@dentocrafts.com',
  country: 'United States',
  logoDataUrl: '',
  currency: 'USD',
  priceVisibilityDefault: true,
  barcodeFormat: 'CODE128',
  lowStockGlobalDefault: 10,
  theme: 'system',
  batchLotTrackingEnabled: false,
}

/**
 * The real production default — no fake business identity. Onboarding
 * always overwrites clinicName/country/currency/logoDataUrl immediately
 * after workspace creation; everything else here is a genuine, sensible
 * technical default (not demo data) that a brand-new workspace should
 * start with regardless.
 */
export const emptyClinicSettings: ClinicSettings = {
  clinicName: '',
  address: '',
  phone: '',
  email: '',
  country: '',
  logoDataUrl: '',
  currency: 'INR',
  priceVisibilityDefault: true,
  barcodeFormat: 'CODE128',
  lowStockGlobalDefault: 10,
  theme: 'system',
  batchLotTrackingEnabled: false,
}

