import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Delete } from 'lucide-react'
import { PinDots } from './PinDots'
import { cn } from '@/lib/utils'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

const KEY_CLASS =
  'flex h-18 w-18 items-center justify-center rounded-full border border-border bg-surface text-xl font-medium text-foreground shadow-sm transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** Spring-based tap feedback — a quick, snappy compress-and-release rather than a flat CSS scale. */
const KEY_TAP = { scale: 0.9 }
const KEY_TAP_TRANSITION = { type: 'spring' as const, stiffness: 500, damping: 20 }

interface PinPadProps {
  value: string
  onChange: (value: string) => void
  length?: number
  error?: boolean
  disabled?: boolean
}

/**
 * Controlled numeric PIN entry: a visually-hidden input captures physical
 * keyboard digits (inputMode="none" so mobile's own software keyboard never
 * pops up alongside our on-screen pad — the pad below is the only keypad a
 * touch user sees), plus a large-touch-target on-screen keypad. Both paths
 * write through the same `value`/`onChange`, so they can be used interchangeably.
 */
export function PinPad({ value, onChange, length = 4, error = false, disabled = false }: PinPadProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!disabled) inputRef.current?.focus()
  }, [disabled])

  const appendDigit = (digit: string) => {
    if (disabled || value.length >= length) return
    onChange(value + digit)
    inputRef.current?.focus()
  }

  const backspace = () => {
    if (disabled) return
    onChange(value.slice(0, -1))
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col items-center gap-10">
      <input
        ref={inputRef}
        type="text"
        inputMode="none"
        autoComplete="one-time-code"
        maxLength={length}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, length))}
        aria-label="Enter your 4-digit PIN"
        className="sr-only"
      />
      <PinDots length={length} filled={value.length} error={error} />
      <div className="grid grid-cols-3 gap-4">
        {KEYS.map((digit) => (
          <motion.button
            key={digit}
            type="button"
            disabled={disabled}
            onClick={() => appendDigit(digit)}
            whileTap={disabled ? undefined : KEY_TAP}
            transition={KEY_TAP_TRANSITION}
            className={cn(KEY_CLASS, disabled && 'opacity-50')}
          >
            {digit}
          </motion.button>
        ))}
        <div aria-hidden="true" />
        <motion.button
          type="button"
          disabled={disabled}
          onClick={() => appendDigit('0')}
          whileTap={disabled ? undefined : KEY_TAP}
          transition={KEY_TAP_TRANSITION}
          className={cn(KEY_CLASS, disabled && 'opacity-50')}
        >
          0
        </motion.button>
        <motion.button
          type="button"
          disabled={disabled || value.length === 0}
          onClick={backspace}
          whileTap={disabled || value.length === 0 ? undefined : KEY_TAP}
          transition={KEY_TAP_TRANSITION}
          aria-label="Delete last digit"
          className={cn(
            'flex h-18 w-18 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            (disabled || value.length === 0) && 'opacity-40',
          )}
        >
          <Delete className="h-5 w-5" aria-hidden="true" />
        </motion.button>
      </div>
    </div>
  )
}
