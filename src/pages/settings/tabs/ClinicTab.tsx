import { useState } from 'react'
import { toast } from 'sonner'
import { Sun, Moon, Laptop } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { TermHint } from '@/components/ui/help-tooltip'
import { useData } from '@/store/DataContext'
import { useTheme } from '@/components/theme/ThemeProvider'
import { cn, simulateLatency } from '@/lib/utils'
import { MICROCOPY } from '@/content/helpText'

export function ClinicTab() {
  const { clinicSettings, updateClinicSettings } = useData()
  const { theme, setTheme } = useTheme()
  const [form, setForm] = useState(clinicSettings)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof typeof form>(k: K) => (v: typeof form[K]) => setForm((prev) => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    await simulateLatency()
    updateClinicSettings(form)
    toast.success('Clinic settings saved', { description: 'Your changes are now in effect.' })
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Clinic Settings</CardTitle>
          <CardDescription>Basic information about your practice</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="col-span-1 sm:col-span-2 space-y-1.5">
            <Label>Clinic name</Label>
            <Input value={form.clinicName} onChange={(e) => set('clinicName')(e.target.value)} />
          </div>
          <div className="col-span-1 sm:col-span-2 space-y-1.5">
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => set('address')(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => set('phone')(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => set('email')(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Select value={form.currency} onValueChange={set('currency')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
                <SelectItem value="GBP">GBP (£)</SelectItem>
                <SelectItem value="INR">INR (₹)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1">
              Default low stock threshold <TermHint term="lowStock" iconOnly />
            </Label>
            <Input type="number" value={form.lowStockGlobalDefault} onChange={(e) => set('lowStockGlobalDefault')(Number(e.target.value) || 0)} />
            <p className="text-xs text-muted-foreground">{MICROCOPY.minStock}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Price Visibility</CardTitle>
          <CardDescription>Control whether pricing is shown to staff by default</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Show prices by default on new products</p>
              <p className="text-xs text-muted-foreground">{MICROCOPY.priceVisible}</p>
            </div>
            <Switch checked={form.priceVisibilityDefault} onCheckedChange={set('priceVisibilityDefault')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1">
            Barcode Settings <TermHint term="barcode" iconOnly />
          </CardTitle>
          <CardDescription>Format used when generating product barcodes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-w-xs">
            <Label>Barcode format</Label>
            <Select value={form.barcodeFormat} onValueChange={set('barcodeFormat')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CODE128">CODE128</SelectItem>
                <SelectItem value="CODE39">CODE39</SelectItem>
                <SelectItem value="EAN13">EAN-13</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1">
            Batch/Lot Tracking <TermHint term="batchLot" iconOnly />
          </CardTitle>
          <CardDescription>Application-wide switch — not a per-product setting</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">{form.batchLotTrackingEnabled ? 'On' : 'Off'}</p>
              <p className="text-xs text-muted-foreground">{MICROCOPY.batchLotTracking}</p>
            </div>
            <Switch checked={form.batchLotTrackingEnabled} onCheckedChange={set('batchLotTrackingEnabled')} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Choose how ImplaTrax looks on this device</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 max-w-md">
            {([
              { value: 'light', label: 'Light', icon: Sun },
              { value: 'dark', label: 'Dark', icon: Moon },
              { value: 'system', label: 'System', icon: Laptop },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors',
                  theme === opt.value ? 'border-primary bg-primary/5 text-primary-700 dark:text-primary-300' : 'border-border hover:bg-surface-hover',
                )}
              >
                <opt.icon className="h-5 w-5" />
                {opt.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving}>Save Changes</Button>
      </div>
    </div>
  )
}
