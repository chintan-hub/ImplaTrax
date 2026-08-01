import { useState } from 'react'
import { toast } from 'sonner'
import { Send, PackageCheck, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { IconHelp } from '@/components/ui/help-tooltip'
import { POReceiveDialog } from '@/components/purchase-orders/POReceiveDialog'
import { useData } from '@/store/DataContext'
import { canSubmitPO, canReceivePO, canCancelPO } from '@/lib/poWorkflow'
import type { PurchaseOrder } from '@/types'

/**
 * The one place Purchase Order status-transition buttons + their
 * confirmation dialogs live — used on both the list page (compact) and the
 * detail page, so the two never drift out of sync with each other or with
 * the canXPO() rules in src/lib/poWorkflow.ts.
 */
export function POStatusActions({ po, size = 'default' }: { po: PurchaseOrder; size?: 'sm' | 'default' }) {
  const { submitPurchaseOrder, cancelPurchaseOrder } = useData()
  const [receiving, setReceiving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {canSubmitPO(po) && (
        <Button size={size} variant="outline" onClick={() => setSubmitting(true)}>
          <Send className="h-3.5 w-3.5" /> Submit
        </Button>
      )}
      {canReceivePO(po) && (
        <IconHelp helpKey="receive">
          <Button size={size} onClick={() => setReceiving(true)}>
            <PackageCheck className="h-3.5 w-3.5" /> Receive
          </Button>
        </IconHelp>
      )}
      {canCancelPO(po) && (
        <Button
          size={size}
          variant="ghost"
          className="text-danger-600 hover:text-danger-700 hover:bg-danger/10"
          onClick={() => setCancelling(true)}
          aria-label={`Cancel purchase order ${po.poNumber}`}
        >
          <XCircle className="h-3.5 w-3.5" /> Cancel
        </Button>
      )}

      <POReceiveDialog po={receiving ? po : null} open={receiving} onOpenChange={setReceiving} />

      <ConfirmDialog
        open={submitting}
        onOpenChange={setSubmitting}
        title={`Submit ${po.poNumber} to vendor?`}
        description="This sends the purchase order to the vendor. It does not change your inventory — you can still cancel it after submitting."
        confirmLabel="Submit"
        onConfirm={() => {
          submitPurchaseOrder(po.id)
          toast.success(`${po.poNumber} submitted to vendor`, { description: 'Status updated to Submitted.' })
        }}
      />

      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={`Cancel ${po.poNumber}?`}
        description="This purchase order will be marked cancelled and can no longer be submitted, confirmed, or received. This cannot be undone."
        confirmLabel="Cancel Purchase Order"
        cancelLabel="Keep Order"
        tone="destructive"
        onConfirm={() => {
          cancelPurchaseOrder(po.id)
          toast.success(`${po.poNumber} cancelled`)
        }}
      />
    </div>
  )
}
