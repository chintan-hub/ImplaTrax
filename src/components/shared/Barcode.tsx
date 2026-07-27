import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import type { ClinicSettings } from '@/types'

export function BarcodeDisplay({
  value,
  format = 'CODE128',
  className,
}: {
  value: string
  /** Clinic-wide setting (ClinicSettings.barcodeFormat) — defaults to CODE128 to match prior behavior when omitted. */
  format?: ClinicSettings['barcodeFormat']
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!ref.current) return
    try {
      JsBarcode(ref.current, value, {
        format,
        width: 1.6,
        height: 40,
        fontSize: 11,
        margin: 6,
        background: 'transparent',
      })
    } catch {
      // Invalid value for the selected format (e.g. a non-EAN13-checksum value
      // under the EAN13 setting) — leave the canvas blank rather than crash.
    }
  }, [value, format])

  return <canvas ref={ref} className={className} />
}

export function QRDisplay({ value, size = 96, className }: { value: string; size?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!ref.current) return
    QRCode.toCanvas(ref.current, value, { width: size, margin: 1 }).catch(() => {})
  }, [value, size])

  return <canvas ref={ref} className={className} width={size} height={size} />
}
