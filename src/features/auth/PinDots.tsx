import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface PinDotsProps {
  length: number
  filled: number
  /** The actual entered digits — only read when `revealed` is true. */
  value?: string
  /** Show the real digits instead of dots. Callers default this to hidden. */
  revealed?: boolean
  error?: boolean
  /** Correct PIN just confirmed — plays a brief, left-to-right confirmation pulse across all dots. */
  success?: boolean
}

export function PinDots({ length, filled, value = '', revealed = false, error = false, success = false }: PinDotsProps) {
  return (
    <motion.div
      className="flex items-center justify-center gap-4 sm:gap-5"
      role="status"
      aria-label={`${filled} of ${length} PIN digits entered${revealed ? ', digits visible' : ''}${error ? ', incorrect PIN' : ''}`}
      animate={error ? { x: [0, -10, 8, -6, 4, -2, 0] } : { x: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      {Array.from({ length }).map((_, i) => {
        const isFilled = i < filled
        const showDigit = revealed && isFilled
        return (
          <motion.div
            key={i}
            aria-hidden="true"
            initial={false}
            animate={
              success
                ? { scale: [1, 1.4, 1.05] }
                : { scale: isFilled && !error ? [0.6, 1.3, 1] : 1 }
            }
            transition={
              success
                ? { duration: 0.45, ease: 'easeOut', delay: i * 0.05 }
                : { type: 'spring', stiffness: 450, damping: 16 }
            }
            className="relative flex h-4.5 w-4.5 items-center justify-center"
          >
            <AnimatePresence initial={false} mode="wait">
              {showDigit ? (
                <motion.span
                  key="digit"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.15 }}
                  className="text-[13px] font-bold tabular-nums text-foreground"
                >
                  {value[i]}
                </motion.span>
              ) : (
                <motion.span
                  key="dot"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    'h-3.5 w-3.5 rounded-full border-2 transition-[background-color,border-color,box-shadow] duration-200',
                    error
                      ? 'border-danger bg-danger/25 shadow-[0_0_0_5px_hsl(var(--danger)/0.15)]'
                      : isFilled
                        ? 'border-teal-400 bg-teal-400 shadow-[0_0_10px_2px_rgba(45,212,191,0.55),0_0_0_4px_hsl(var(--primary)/0.15)]'
                        : 'border-border/70 bg-transparent',
                    success && 'shadow-[0_0_16px_4px_rgba(45,212,191,0.75),0_0_0_7px_hsl(var(--primary)/0.28)]',
                  )}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
