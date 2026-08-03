import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input, type InputProps } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * A password `Input` with a show/hide toggle — every password field in the
 * app renders through here so the behavior (and the toggle button's exact
 * position/hit target) never drifts between forms.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} className={cn('pr-9', className)} ref={ref} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-r-lg"
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  )
})
PasswordInput.displayName = 'PasswordInput'
