import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Delete, Eye, EyeOff } from 'lucide-react'
import { PinDots } from './PinDots'
import { cn } from '@/lib/utils'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

/**
 * Compact, perfectly circular keys — smaller than a typical numeric keypad
 * (h-13/h-14 rather than h-16/h-20) so the pad reads as a precise input
 * control, not an oversized touch target. Depth still comes from layering,
 * not a flat fill: an inset top highlight, a two-tier shadow, a crisp rim,
 * a hover lift that brightens the rim toward primary, and a pressed state
 * that flattens with a brief teal glow.
 */
const KEY_CLASS = cn(
  'relative flex h-14 w-14 touch-manipulation items-center justify-center rounded-full text-lg font-semibold text-foreground select-none sm:text-xl',
  'bg-gradient-to-b from-card to-card/85 border border-black/[0.06]',
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-1px_1px_rgba(15,23,42,0.03),0_1px_2px_rgba(15,23,42,0.05),0_8px_14px_-8px_rgba(15,23,42,0.16)]',
  'dark:from-white/[0.10] dark:to-white/[0.035] dark:border-white/[0.12]',
  'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.13),inset_0_-1px_1px_rgba(0,0,0,0.25),0_1px_2px_rgba(0,0,0,0.35),0_10px_16px_-8px_rgba(0,0,0,0.45)]',
  'transition-all duration-150 ease-out disabled:cursor-not-allowed',
  'hover:-translate-y-[2px] hover:scale-[1.04] hover:border-teal-400/50',
  'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-1px_1px_rgba(15,23,42,0.03),0_1px_2px_rgba(15,23,42,0.05),0_12px_20px_-8px_rgba(15,23,42,0.2),0_0_0_4px_rgba(45,212,191,0.12)]',
  'dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-1px_1px_rgba(0,0,0,0.25),0_1px_2px_rgba(0,0,0,0.35),0_14px_24px_-8px_rgba(0,0,0,0.5),0_0_0_4px_rgba(45,212,191,0.18)]',
  'active:translate-y-0 active:scale-[0.96] active:border-teal-400/70',
  'active:shadow-[inset_0_2px_4px_rgba(15,23,42,0.14),0_0_14px_2px_rgba(45,212,191,0.35)]',
  'dark:active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.45),0_0_18px_3px_rgba(45,212,191,0.4)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
)

/** Spring-based tap feedback — a smooth, damped compress-and-release (closer to iOS's control feel than a bouncy spring). */
const KEY_TAP = { scale: 0.9 }
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
 * Dual-input PIN entry: digits can be typed on a physical keyboard
 * (0-9, Backspace/Delete, Escape — a document-level listener, so it works
 * the instant this screen is on-screen, with no hidden input to keep
 * focused) or tapped on the on-screen numpad below. Both paths write
 * through the same `value`/`onChange`.
 */
export function PinPad({ value, onChange, length = 4, error = false, success = false, disabled = false }: PinPadProps) {
  const [revealed, setRevealed] = useState(false)

  const appendDigit = (digit: string) => {
    if (disabled || value.length >= length) return
    onChange(value + digit)
  }

  const backspace = () => {
    if (disabled || value.length === 0) return
    onChange(value.slice(0, -1))
  }

  useEffect(() => {
    if (disabled) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        appendDigit(e.key)
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        backspace()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onChange('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, onChange, length, disabled])

  return (
    <div className="flex flex-col items-center gap-5 sm:gap-7">
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
            'hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400',
            disabled && 'pointer-events-none opacity-40',
          )}
        >
          {revealed ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5" role="group" aria-label="PIN numpad — you can also type your PIN on your keyboard">
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
          className={cn(KEY_CLASS, 'text-base text-muted-foreground', (disabled || value.length === 0) && 'opacity-40')}
        >
          <Delete className="h-4.5 w-4.5" aria-hidden="true" />
        </motion.button>
      </div>
    </div>
  )
}
