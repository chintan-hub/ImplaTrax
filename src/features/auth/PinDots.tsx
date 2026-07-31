import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface PinDotsProps {
  length: number
  filled: number
  error?: boolean
}

export function PinDots({ length, filled, error = false }: PinDotsProps) {
  return (
    <motion.div
      className="flex items-center justify-center gap-5"
      role="status"
      aria-label={`${filled} of ${length} PIN digits entered${error ? ', incorrect PIN' : ''}`}
      animate={error ? { x: [0, -9, 9, -9, 9, 0] } : { x: 0 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
    >
      {Array.from({ length }).map((_, i) => {
        const isFilled = i < filled
        return (
          <motion.div
            key={i}
            aria-hidden="true"
            initial={false}
            animate={{ scale: isFilled && !error ? [1, 1.25, 1] : 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={cn(
              'h-4 w-4 rounded-full border-2 transition-colors duration-150',
              error
                ? 'border-danger bg-danger/25'
                : isFilled
                  ? 'border-primary bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.15)]'
                  : 'border-border/80 bg-transparent',
            )}
          />
        )
      })}
    </motion.div>
  )
}
