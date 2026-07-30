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
 * Root-level render-phase safety net. Without this, any uncaught exception
 * in the component tree unmounts the whole React app and leaves a blank
 * page — no way back short of a manual reload the user has to guess to try.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-100 text-danger-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-semibold">Something went wrong</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              An unexpected error occurred. Your data is safe — reloading the page usually resolves this.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { this.setState({ error: null }); window.location.assign('/') }}>
              Go to Dashboard
            </Button>
            <Button onClick={() => window.location.reload()}>Reload Page</Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
