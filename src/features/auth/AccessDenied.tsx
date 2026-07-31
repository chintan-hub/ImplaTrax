import { ShieldAlert } from 'lucide-react'

/** Inline "you don't have permission" panel — used in place of a section's content, never a dead route, so the back button and surrounding page still work normally. */
export function AccessDenied({ message = "You don't have permission to view this section." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
      <ShieldAlert className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="font-medium text-foreground">Access Denied</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}
