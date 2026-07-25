import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'

export function BarcodeDisplay({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!ref.current) return
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        width: 1.6,
        height: 40,
        fontSize: 11,
        margin: 6,
        background: 'transparent',
      })
    } catch {
      // ignore invalid barcode values
    }
  }, [value])

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
