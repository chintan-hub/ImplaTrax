import { Badge } from '@/components/ui/badge'
import type { CaseStatus, LoanStatus, POStatus, Product } from '@/types'

type AnyStatus = CaseStatus | LoanStatus | POStatus | Product['status']

// Record<AnyStatus, ...> (rather than Record<string, ...>) makes this
// exhaustive: adding a new value to any of the status unions in
// src/types/index.ts without adding a matching entry here is now a build
// error instead of a silent runtime fallback to the generic 'outline' badge
// (see ARCHITECTURE.md §6.4).
const STATUS_CONFIG: Record<AnyStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'accent' | 'outline' }> = {
  // Case
  planning: { label: 'Planning', variant: 'secondary' },
  'surgery-scheduled': { label: 'Surgery Scheduled', variant: 'accent' },
  'in-progress': { label: 'In Progress', variant: 'default' },
  restoration: { label: 'Restoration', variant: 'warning' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
  // Loan
  open: { label: 'Open', variant: 'warning' },
  'partially-returned': { label: 'Partially Returned', variant: 'accent' },
  closed: { label: 'Closed', variant: 'success' },
  // PO
  draft: { label: 'Draft', variant: 'secondary' },
  submitted: { label: 'Submitted', variant: 'default' },
  confirmed: { label: 'Confirmed', variant: 'accent' },
  'partially-received': { label: 'Partially Received', variant: 'warning' },
  received: { label: 'Received', variant: 'success' },
  // Product
  active: { label: 'Active', variant: 'success' },
  discontinued: { label: 'Discontinued', variant: 'secondary' },
}

export function StatusBadge({ status }: { status: AnyStatus }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: 'outline' as const }
  return <Badge variant={config.variant}>{config.label}</Badge>
}
