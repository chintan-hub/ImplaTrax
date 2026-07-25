import type { ClinicSettings } from '@/types'

export const defaultClinicSettings: ClinicSettings = {
  clinicName: 'DentoCrafts Implant & Prosthodontics',
  address: '4820 Meridian Ave, Suite 210, Austin, TX 78745',
  phone: '+1 (512) 555-0148',
  email: 'info@dentocrafts.com',
  currency: 'USD',
  priceVisibilityDefault: true,
  barcodeFormat: 'CODE128',
  lowStockGlobalDefault: 10,
  theme: 'system',
}
