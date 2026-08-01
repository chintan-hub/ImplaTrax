import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTour } from './TourContext'

export function WelcomeTourPrompt() {
  const { promptOpen, closePrompt, dontShowAgain, startTour } = useTour()

  return (
    <Dialog open={promptOpen} onOpenChange={(v) => !v && closePrompt()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="items-center text-center">
          <DialogTitle>Welcome to ImplaTrax</DialogTitle>
          <DialogDescription>Would you like a quick 2-minute tour of the essentials?</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button className="w-full" onClick={startTour}>
            Start Tour
          </Button>
          <div className="flex w-full gap-2">
            <Button variant="outline" className="flex-1" onClick={closePrompt}>
              Skip
            </Button>
            <Button variant="ghost" className="flex-1 text-muted-foreground" onClick={dontShowAgain}>
              Don't show again
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
