import { FileDown } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

export const USER_GUIDE_PATH = '/docs/user-guide.pdf'

/**
 * Renders the static PDF at `public/docs/user-guide.pdf` in an iframe. That
 * path is a plain static asset, not a React Router route, so it's served
 * directly by Vercel's CDN/filesystem layer ahead of the SPA's catch-all
 * rewrite and never touches AuthGate — a fresh preview URL with nobody
 * signed in can still open the guide.
 */
export function UserGuideModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] w-[calc(100%-2rem)] max-w-4xl flex-col gap-3 p-4 sm:p-5">
        <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0 pr-6">
          <div>
            <DialogTitle>User Manual</DialogTitle>
            <DialogDescription>The complete ImplaTrax User Manual</DialogDescription>
          </div>
          <a
            href={USER_GUIDE_PATH}
            download
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            <FileDown className="h-3.5 w-3.5" aria-hidden="true" /> Download
          </a>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
          <iframe src={USER_GUIDE_PATH} title="ImplaTrax User Manual" className="h-full w-full" />
        </div>
      </DialogContent>
    </Dialog>
  )
}
