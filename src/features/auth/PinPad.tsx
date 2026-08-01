import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Delete, Eye, EyeOff } from 'lucide-react'
import { PinDots } from './PinDots'
import { cn } from '@/lib/utils'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

/**
 * Keys need to read as physical, pressable hardware at a glance. That
 * comes from layering, not a single flat color: an inset highlight along
 * the top rim (light catching a raised edge), a real two-tier shadow
 * (a tight contact shadow plus a soft ambient one — not one flat blur) to
 * lift the key off the card, a crisp rim border, a hover state that lifts
 * the key further and brightens the rim toward primary, and a pressed
 * state that flattens the key back down with a brief primary glow instead
 * of just a plain darker fill. Dark mode leans on a lighter fill for
 * contrast rather than shadow, since shadows barely register on dark
 * backgrounds.
 */
const KEY_CLASS = cn(
  'relative flex h-16 w-16 touch-manipulation items-center justify-center rounded-full text-2xl font-semibold text-foreground select-none sm:h-20 sm:w-20',
  'bg-gradient-to-b from-card to-card/85 border border-black/[0.06]',
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-1px_1px_rgba(15,23,42,0.03),0_1px_2px_rgba(15,23,42,0.05),0_10px_16px_-8px_rgba(15,23,42,0.16)]',
  'dark:from-white/[0.10] dark:to-white/[0.035] dark:border-white/[0.12]',
  'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.13),inset_0_-1px_1px_rgba(0,0,0,0.25),0_1px_2px_rgba(0,0,0,0.35),0_12px_18px_-8px_rgba(0,0,0,0.45)]',
  'transition-all duration-150 ease-out disabled:cursor-not-allowed',
  'hover:-translate-y-[2px] hover:border-primary/40',
  'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-1px_1px_rgba(15,23,42,0.03),0_1px_2px_rgba(15,23,42,0.05),0_14px_22px_-8px_rgba(15,23,42,0.2),0_0_0_4px_hsl(var(--primary)/0.09)]',
  'dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-1px_1px_rgba(0,0,0,0.25),0_1px_2px_rgba(0,0,0,0.35),0_16px_26px_-8px_rgba(0,0,0,0.5),0_0_0_4px_hsl(var(--primary)/0.14)]',
  'active:translate-y-0 active:border-primary/60',
  'active:shadow-[inset_0_2px_4px_rgba(15,23,42,0.14),0_0_14px_2px_hsl(var(--primary)/0.3)]',
  'dark:active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.45),0_0_18px_3px_hsl(var(--primary)/0.35)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
)

/** Spring-based tap feedback — a smooth, damped compress-and-release (closer to iOS's control feel than a bouncy spring). */
const KEY_TAP = { scale: 0.92 }
const KEY_TAP_TRANSITION = { type: 'spring' as const, stiffness: 420, damping: 26 }

interface PinPadProps {
  value: string
  onChange: (value: string) => void
  length?: number
  error?: boolean
  /** Correct PIN just confirmed — plays a confirmation pulse across the dots. */
  success?: boolean
  disabled?: boolean
}

/**
 * Controlled numeric PIN entry: a visually-hidden input captures physical
 * keyboard digits (inputMode="none" so mobile's own software keyboard never
 * pops up alongside our on-screen pad — the pad below is the only keypad a
 * touch user sees), plus a large-touch-target on-screen keypad. Both paths
 * write through the same `value`/`onChange`, so they can be used interchangeably.
 */
export function PinPad({ value, onChange, length = 4, error = false, success = false, disabled = false }: PinPadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [revealed, setRevealed] = useState(false)

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
    <div className="flex flex-col items-center gap-5 sm:gap-11">
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
      <div className="relative flex items-center justify-center">
        <PinDots length={length} filled={value.length} value={value} revealed={revealed} error={error} success={success} />
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          disabled={disabled}
          aria-label={revealed ? 'Hide PIN digits' : 'Show PIN digits'}
          aria-pressed={revealed}
          className={cn(
            'absolute left-full ml-2 flex h-8 w-8 touch-manipulation items-center justify-center rounded-full text-muted-foreground transition-colors',
            'hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            disabled && 'pointer-events-none opacity-40',
          )}
        >
          {revealed ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {KEYS.map((digit) => (
          <motion.button
            key={digit}
            type="button"
            disabled={disabled}
            onClick={() => appendDigit(digit)}
            whileTap={disabled ? undefined : KEY_TAP}
            transition={KEY_TAP_TRANSITION}
            className={cn(KEY_CLASS, disabled && 'opacity-40')}
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
          className={cn(KEY_CLASS, disabled && 'opacity-40')}
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
          className={cn(KEY_CLASS, 'text-lg text-muted-foreground', (disabled || value.length === 0) && 'opacity-40')}
        >
          <Delete className="h-5 w-5" aria-hidden="true" />
        </motion.button>
      </div>
    </div>
  )
}
