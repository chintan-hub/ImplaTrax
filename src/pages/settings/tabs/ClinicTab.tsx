import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { Sun, Moon, Laptop, Stethoscope, Factory, Plus } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { TermHint } from '@/components/ui/help-tooltip'
import { useData } from '@/store/DataContext'
import { useAuth } from '@/features/auth/AuthContext'
import { WORKSPACE_MANAGER_ROLES } from '@/features/auth/accountTypes'
import { useTheme } from '@/components/theme/ThemeProvider'
import { useDirtyState } from '@/hooks/useDirtyState'
import { cn, simulateLatency } from '@/lib/utils'
import { MICROCOPY } from '@/content/helpText'
import { useRegisterSettingsSaveAction } from '../SettingsHeaderActionContext'

function DoctorsCard() {
  const { doctors, patients, cases, addDoctor, setDoctorActive } = useData()
  const { currentMember } = useAuth()
  const canManage = Boolean(currentMember && WORKSPACE_MANAGER_ROLES.includes(currentMember.role))
  const [newName, setNewName] = useState('')
  const sorted = [...doctors].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))

  const handleAdd = () => {
    const name = newName.trim()
    if (!name) {
      toast.error('Enter a doctor name.')
      return
    }
    if (doctors.some((d) => d.name.toLowerCase() === name.toLowerCase())) {
      toast.error('A doctor with that name already exists.')
      return
    }
    addDoctor({ name })
    toast.success(`Dr. ${name} added`)
    setNewName('')
  }

  const linkedRecordCount = (doctorName: string) => {
    const label = `Dr. ${doctorName}`
    return patients.filter((p) => p.primaryDoctor === label).length + cases.filter((c) => c.doctor === label).length
  }

  const handleDelete = (id: string, name: string) => {
    const linked = linkedRecordCount(name)
    setDoctorActive(id, false)
    if (linked > 0) {
      toast.success(`Dr. ${name} archived`, { description: `${linked} existing patient/case record(s) still reference this doctor and are unaffected.` })
    } else {
      toast.success(`Dr. ${name} archived`, { description: 'Removed from the doctor picker for new selections.' })
    }
  }

  const handleReactivate = (id: string, name: string) => {
    setDoctorActive(id, true)
    toast.success(`Dr. ${name} reactivated`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Stethoscope className="h-4 w-4" /> Doctors
        </CardTitle>
        <CardDescription>Doctors available when assigning cases and patients</CardDescription>
      </CardHeader>
      <CardContent>
        {canManage && (
          <div className="mb-4 flex gap-2">
            <Input placeholder="Doctor name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
            <Button onClick={handleAdd} className="shrink-0">
              <Plus className="h-4 w-4" /> Add Doctor
            </Button>
          </div>
        )}
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No doctors added yet.</p>
        ) : (
          <div className="rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">Dr. {d.name}</TableCell>
                    <TableCell>
                      <Badge variant={d.active ? 'success' : 'secondary'}>{d.active ? 'Active' : 'Archived'}</Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        {d.active ? (
                          <Button variant="ghost" size="sm" className="text-danger-700 dark:text-danger-500" onClick={() => handleDelete(d.id, d.name)}>
                            Delete
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => handleReactivate(d.id, d.name)}>
                            Reactivate
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ManufacturersCard() {
  const { manufacturers, addManufacturer } = useData()
  const { currentMember } = useAuth()
  const canManage = Boolean(currentMember && WORKSPACE_MANAGER_ROLES.includes(currentMember.role))
  const [newName, setNewName] = useState('')
  const sorted = [...manufacturers].sort((a, b) => a.name.localeCompare(b.name))

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) {
      toast.error('Enter a manufacturer name.')
      return
    }
    if (manufacturers.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
      toast.error('A manufacturer with that name already exists.')
      return
    }
    try {
      await addManufacturer(name)
      toast.success(`${name} added`, { description: 'Now available when creating or editing a product.' })
      setNewName('')
    } catch (err) {
      toast.error('Could not add manufacturer', { description: err instanceof Error ? err.message : undefined })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Factory className="h-4 w-4" /> Manufacturers
        </CardTitle>
        <CardDescription>Manufacturers available when creating or editing a product, in addition to the built-in catalog</CardDescription>
      </CardHeader>
      <CardContent>
        {canManage && (
          <div className="mb-4 flex gap-2">
            <Input
              placeholder="Manufacturer name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <Button onClick={handleAdd} className="shrink-0">
              <Plus className="h-4 w-4" /> Add Manufacturer
            </Button>
          </div>
        )}
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No manufacturers yet.</p>
        ) : (
          <div className="rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>
                      <Badge variant={m.isGlobal ? 'outline' : 'secondary'}>{m.isGlobal ? 'Built-in' : 'Custom'}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ClinicTab() {
  const { clinicSettings, updateClinicSettings } = useData()
  const { theme, setTheme } = useTheme()
  const [form, setForm] = useState(clinicSettings)
  const [saving, setSaving] = useState(false)
  const isDirty = useDirtyState(clinicSettings, form)

  const set = <K extends keyof typeof form>(k: K) => (v: typeof form[K]) => setForm((prev) => ({ ...prev, [k]: v }))

  const handleSave = useCallback(async () => {
    setSaving(true)
    await simulateLatency()
    updateClinicSettings(form)
    toast.success('Clinic settings saved', { description: 'Your changes are now in effect.' })
    setSaving(false)
  }, [form, updateClinicSettings])

  useRegisterSettingsSaveAction({ isDirty, saving, onSave: handleSave })

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

      <DoctorsCard />

      <ManufacturersCard />

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

    </div>
  )
}
