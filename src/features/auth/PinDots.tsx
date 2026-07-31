import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface PinDotsProps {
  length: number
  filled: number
  error?: boolean
  /** Correct PIN just confirmed — plays a brief, left-to-right confirmation pulse across all dots. */
  success?: boolean
}

export function PinDots({ length, filled, error = false, success = false }: PinDotsProps) {
  return (
    <motion.div
      className="flex items-center justify-center gap-5"
      role="status"
      aria-label={`${filled} of ${length} PIN digits entered${error ? ', incorrect PIN' : ''}`}
      animate={error ? { x: [0, -10, 8, -6, 4, -2, 0] } : { x: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      {Array.from({ length }).map((_, i) => {
        const isFilled = i < filled
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
            className={cn(
              'h-4.5 w-4.5 rounded-full border-2 transition-colors duration-150',
              error
                ? 'border-danger bg-danger/25'
                : isFilled
                  ? 'border-primary bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.15)]'
                  : 'border-border/80 bg-transparent',
              success && 'shadow-[0_0_0_7px_hsl(var(--primary)/0.28)]',
            )}
          />
        )
      })}
    </motion.div>
  )
}
