import { Info, Languages, Database, BookOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Logo } from '@/components/brand/Logo'
import { ManualDownloadButton } from '@/components/manual/ManualDownloadButton'
import { BRAND } from '@/content/helpText'

const APP_VERSION = '2.0.0'

export function AboutTab() {
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Info className="h-4 w-4" /> About ImplaTrax
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Logo className="h-7 w-auto" />
          <p className="text-sm text-muted-foreground">{BRAND.tagline}</p>
          <p className="text-sm text-muted-foreground">Version {APP_VERSION} · Runs entirely on this device</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" /> User Manual
          </CardTitle>
          <CardDescription>The complete, searchable ImplaTrax user guide — every module, workflow, and business rule, in one PDF</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate('/manual')}>
            View User Manual
          </Button>
          <ManualDownloadButton variant="outline" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Languages className="h-4 w-4" /> Language
          </CardTitle>
          <CardDescription>Choose your preferred language</CardDescription>
        </CardHeader>
        <CardContent className="max-w-xs space-y-1.5">
          <Select value="en" disabled>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">More languages are coming in a future release.</p>
        </CardContent>
      </Card>

      <Card className="opacity-70">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Database className="h-4 w-4" /> Backup & Restore
          </CardTitle>
          <CardDescription>Download or restore a full backup of your workspace</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button disabled variant="outline">
            Download Backup
          </Button>
          <Button disabled variant="outline">
            Restore from Backup
          </Button>
        </CardContent>
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">Coming soon.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>ImplaTrax runs entirely in your browser. Your workspace data, PIN, and settings are stored only in this browser's local storage on this device.</p>
          <p>Nothing is transmitted to a server — there is no backend. Clearing your browser's site data for ImplaTrax will permanently erase everything.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Terms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>ImplaTrax is provided as-is for managing dental implant inventory. You are responsible for your own data backups, since all data lives locally on your device.</p>
        </CardContent>
      </Card>
    </div>
  )
}
