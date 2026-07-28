import { useState } from 'react'
import { Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconHelp } from '@/components/ui/help-tooltip'
import { LoanReturnDialog } from '@/components/loans/LoanReturnDialog'
import { canReturnLoan } from '@/lib/loanWorkflow'
import type { Loan } from '@/types'

/**
 * The one place Loan status-transition actions + their dialogs live — used
 * on both the list page (compact) and the detail page, so the two never
 * drift out of sync with each other or with canReturnLoan() in
 * src/lib/loanWorkflow.ts. Mirrors POStatusActions.tsx.
 */
export function LoanStatusActions({ loan, size = 'default' }: { loan: Loan; size?: 'sm' | 'default' }) {
  const [returning, setReturning] = useState(false)

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {canReturnLoan(loan) && (
        <IconHelp helpKey="processReturn">
          <Button size={size} variant="outline" onClick={() => setReturning(true)}>
            <Undo2 className="h-3.5 w-3.5" /> Process Return
          </Button>
        </IconHelp>
      )}

      <LoanReturnDialog loan={returning ? loan : null} open={returning} onOpenChange={setReturning} />
    </div>
  )
}
