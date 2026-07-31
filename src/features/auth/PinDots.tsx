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
      className="flex items-center justify-center gap-4"
      role="status"
      aria-label={`${filled} of ${length} PIN digits entered${error ? ', incorrect PIN' : ''}`}
      animate={error ? { x: [0, -8, 8, -8, 8, 0] } : { x: 0 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
    >
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={cn(
            'h-3.5 w-3.5 rounded-full border-2 transition-colors duration-150',
            error ? 'border-danger bg-danger/20' : i < filled ? 'border-primary bg-primary' : 'border-border bg-transparent',
          )}
        />
      ))}
    </motion.div>
  )
}
