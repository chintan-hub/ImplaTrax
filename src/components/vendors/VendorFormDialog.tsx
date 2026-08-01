import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useData } from '@/store/DataContext'
import { simulateLatency } from '@/lib/utils'
import { MANUFACTURERS } from '@/types'
import type { Manufacturer, Vendor } from '@/types'

const EMPTY_FORM = { name: '', contactName: '', email: '', phone: '', address: '', country: 'United States' }

export function VendorFormDialog({ open, onOpenChange, vendor }: { open: boolean; onOpenChange: (v: boolean) => void; vendor?: Vendor }) {
  const { addVendor, updateVendor } = useData()
  const isEdit = !!vendor
  const [form, setForm] = useState(EMPTY_FORM)
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(vendor ? { name: vendor.name, contactName: vendor.contactName, email: vendor.email, phone: vendor.phone, address: vendor.address, country: vendor.country } : EMPTY_FORM)
      setManufacturers(vendor?.manufacturers ?? [])
    }
  }, [open, vendor])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [k]: e.target.value }))

  const toggleManufacturer = (m: Manufacturer, checked: boolean) => {
    setManufacturers((prev) => (checked ? [...prev, m] : prev.filter((x) => x !== m)))
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Vendor name is required.')
      return
    }
    if (manufacturers.length === 0) {
      toast.error('Select at least one manufacturer this vendor supplies.')
      return
    }
    setSubmitting(true)
    await simulateLatency()
    try {
      if (isEdit && vendor) {
        updateVendor(vendor.id, { ...form, manufacturers })
        toast.success(`Vendor "${form.name}" updated`)
      } else {
        addVendor({ ...form, manufacturers })
        toast.success(`Vendor "${form.name}" added`, { description: 'It now appears in your vendor directory.' })
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(isEdit ? 'Could not update vendor' : 'Could not add vendor', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Vendor' : 'Add Vendor'}</DialogTitle>
          <DialogDescription>{isEdit ? "Update this vendor's details." : 'Add a new vendor to your directory.'}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="col-span-1 space-y-1.5 sm:col-span-2">
            <Label htmlFor="vendor-name">Vendor name</Label>
            <Input id="vendor-name" value={form.name} onChange={set('name')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vendor-contact">Contact name</Label>
            <Input id="vendor-contact" value={form.contactName} onChange={set('contactName')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vendor-email">Email</Label>
            <Input id="vendor-email" type="email" value={form.email} onChange={set('email')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vendor-phone">Phone</Label>
            <Input id="vendor-phone" value={form.phone} onChange={set('phone')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vendor-country">Country</Label>
            <Input id="vendor-country" value={form.country} onChange={set('country')} />
          </div>
          <div className="col-span-1 space-y-1.5 sm:col-span-2">
            <Label htmlFor="vendor-address">Address</Label>
            <Input id="vendor-address" value={form.address} onChange={set('address')} />
          </div>
          <div className="col-span-1 space-y-1.5 sm:col-span-2">
            <Label>Manufacturers supplied</Label>
            <p className="text-xs text-muted-foreground">Determines which products can be ordered from this vendor on a Purchase Order.</p>
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 sm:grid-cols-3">
              {MANUFACTURERS.map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={manufacturers.includes(m)} onCheckedChange={(v) => toggleManufacturer(m, v === true)} />
                  {m}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting}>{isEdit ? 'Save Changes' : 'Add Vendor'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
