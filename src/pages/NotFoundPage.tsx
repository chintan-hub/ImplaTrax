import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <p className="text-5xl font-semibold tracking-tight">404</p>
      <p className="text-sm text-muted-foreground">This page doesn't exist.</p>
      <Button asChild size="sm">
        <Link to="/">Back to Dashboard</Link>
      </Button>
    </div>
  )
}
