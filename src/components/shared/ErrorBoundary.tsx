import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Sits above the routed app (see App.tsx) as the last line of defense — a
 * render-phase error in any page (a bad DataContext read, a malformed
 * record) would otherwise unmount the entire React tree to a blank white
 * screen with no way back except a manual reload. Deliberately does not try
 * to recover in place (no "retry" that just re-renders the same broken
 * subtree) — a full reload is the only thing guaranteed to clear whatever
 * caused it.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in ImplaTrax:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger-600">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              ImplaTrax hit an unexpected error and can't continue safely. Your data is saved — reloading the page should fix this.
            </p>
          </div>
          <Button onClick={() => window.location.reload()}>Reload ImplaTrax</Button>
        </div>
      )
    }
    return this.props.children
  }
}
